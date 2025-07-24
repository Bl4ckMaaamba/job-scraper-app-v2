import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import { storeResults } from '../../../lib/storage'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sites, csvData, interval = 5 } = body

    if (!sites || !csvData) {
      return NextResponse.json(
        { error: 'Sites et données CSV requis' },
        { status: 400 }
      )
    }

    const jobId = `job_${Date.now()}`
    const allResults = []
    let totalJobs = 0

    console.log(`Sites sélectionnés: ${sites.join(', ')}`)
    console.log(`Type de sites: ${typeof sites}`)
    console.log(`Longueur de sites: ${sites.length}`)
    console.log(`Sites individuels:`, sites)

    // Traitement de tous les sites sélectionnés
    for (const site of sites) {
      console.log(`Traitement du site: ${site}`)
      console.log(`Type du site: ${typeof site}`)
      console.log(`Site === 'indeed': ${site === 'indeed'}`)
      console.log(`Site === 'linkedin': ${site === 'linkedin'}`)
      console.log(`Site === 'proprietary': ${site === 'proprietary'}`)
      
      if (site === 'proprietary') {
        try {
          console.log('🧠 Démarrage du scraping adaptatif...')
          
          // Créer un fichier CSV temporaire
          const tempCsvPath = path.join(process.cwd(), `temp_companies_${jobId}.csv`)
          fs.writeFileSync(tempCsvPath, csvData)

          // Exécuter le scraper adaptatif
          const { stdout, stderr } = await execAsync(`node "${path.join(process.cwd(), 'scraper_adaptatif.js')}" "${tempCsvPath}"`)
          
          // Nettoyer le fichier temporaire
          fs.unlinkSync(tempCsvPath)

          if (stderr) {
            console.log('Stderr adaptatif:', stderr)
          }

          // Lire le fichier de résultats généré
          const resultFiles = fs.readdirSync(process.cwd()).filter(f => f.startsWith('scraping-adaptatif-'))
          const latestResultFile = resultFiles.sort().pop()
          
          if (latestResultFile) {
            const adaptiveResults = JSON.parse(fs.readFileSync(latestResultFile, 'utf8'))
            
            // Transformer les résultats pour l'interface
            const formattedResults = []
            for (const companyResult of adaptiveResults) {
              if (companyResult.jobs && companyResult.jobs.length > 0) {
                for (const job of companyResult.jobs) {
                  formattedResults.push({
                    id: `adaptatif_${Math.random()}`,
                    title: job.title || '',
                    company: job.company || companyResult.company,
                    location: job.location || '',
                    date: job.scraped_at ? job.scraped_at.split('T')[0] : new Date().toISOString().split('T')[0],
                    description: '',
                    url: job.link || companyResult.jobsUrl || '',
                    site: `Site Officiel${companyResult.pageType ? ' (' + companyResult.pageType + ')' : ''}`,
                    status: 'NEW',
                    scraped_at: new Date().toISOString(),
                    // Données additionnelles pour le debug
                    websiteUrl: companyResult.website,
                    jobsPageUrl: companyResult.jobsUrl,
                    extractionType: companyResult.pageType,
                    scrapingStatus: companyResult.status
                  })
                }
              }
              // Les entreprises sans offres ne sont plus ajoutées au JSON
            }
            
            allResults.push(...formattedResults)
            totalJobs += formattedResults.filter(r => r.status === 'NEW').length
            
            // Nettoyer le fichier de résultats
            fs.unlinkSync(latestResultFile)
            
            const successfulJobs = formattedResults.filter(r => r.status === 'NEW').length
            
            console.log(`🎯 Scraper Adaptatif: ${successfulJobs} offres trouvées`)
          } else {
            console.log('Aucun fichier de résultats trouvé pour le scraping adaptatif')
          }

        } catch (error) {
          console.log('Erreur lors du scraping adaptatif:', error)
        }
      } else if (site === 'linkedin') {
        try {
          console.log('=== DÉMARRAGE DU SCRAPING LINKEDIN ===')
          
          // Créer le scraper LinkedIn intégré
          const linkedinScraperCode = `
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

function parseCsvCompanies(csvContent) {
    const companies = [];
    const lines = csvContent.trim().split('\\n');
    
    if (!lines.length) return companies;
    
    const csvLines = lines.slice(1);
    
    csvLines.forEach(line => {
        const parts = line.split(',');
        if (parts.length > 0) {
            const company = parts[0].trim().replace(/"/g, '');
            if (company && company.length > 0 && !companies.includes(company)) {
                companies.push(company);
            }
        }
    });
    
    return companies;
}

async function getJobsFromLinkedin(browser, company, location = 'France') {
    const page = await browser.newPage();
    
    try {
        await page.setExtraHTTPHeaders({'accept-language': 'fr-FR,fr;q=0.9'});
        
        const searchUrl = \`https://linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords="\${encodeURIComponent(company)}"&start=0&location=\${encodeURIComponent(location)}\`;
        
        console.log(\`LinkedIn - Query: \${company}, Location: \${location}, Page: 0, url: \${searchUrl}\`);
        
        await page.goto(searchUrl, {waitUntil: 'networkidle2'});
        
        try {
            await page.waitForSelector('.job-search-card', {timeout: 10000});
            console.log('Job cards trouvées');
        } catch (timeoutError) {
            console.log('Timeout job cards, essai avec d\\'autres sélecteurs...');
            const selectors = [
                '.job-search-card',
                '.job-card-container',
                '.job-card',
                '[data-job-id]',
                '.job-result-card'
            ];
            
            let foundSelector = null;
            for (const selector of selectors) {
                try {
                    await page.waitForSelector(selector, {timeout: 2000});
                    foundSelector = selector;
                    console.log(\`Sélecteur trouvé: \${selector}\`);
                    break;
                } catch (e) {
                    console.log(\`Sélecteur \${selector} non trouvé\`);
                }
            }
            
            if (!foundSelector) {
                console.log('Aucun sélecteur de job trouvé, vérification du contenu de la page...');
                const pageContent = await page.content();
                console.log('Contenu de la page:', pageContent.substring(0, 1000));
                throw new Error('Aucun job trouvé sur la page');
            }
        }
        
        const jobs = await page.evaluate(() => {
            const selectors = [
                '.job-search-card',
                '.job-card-container',
                '.job-card',
                '[data-job-id]',
                '.job-result-card'
            ];
            
            let jobCards = [];
            for (const selector of selectors) {
                jobCards = document.querySelectorAll(selector);
                if (jobCards.length > 0) {
                    console.log(\`Trouvé \${jobCards.length} jobs avec le sélecteur: \${selector}\`);
                    break;
                }
            }
            
            const jobs = [];
            
            jobCards.forEach((card, index) => {
                try {
                    const titleSelectors = ['.job-search-card__title', '.job-card__title', 'h3', 'h4', '[data-test-job-title]'];
                    const companySelectors = [
                        '.job-search-card__subtitle', 
                        '.job-card__subtitle', 
                        '.job-card__company', 
                        '[data-test-job-company]',
                        '.job-search-card__company',
                        '.job-result-card__company',
                        '.job-card__company-name',
                        '.job-search-card__company-name'
                    ];
                    const locationSelectors = ['.job-search-card__location', '.job-card__location', '[data-test-job-location]'];
                    const dateSelectors = ['.job-search-card__listdate', '.job-card__date', '[data-test-job-date]'];
                    
                    let titleElement = null;
                    let companyElement = null;
                    let locationElement = null;
                    let dateElement = null;
                    let linkElement = null;
                    
                    for (const selector of titleSelectors) {
                        titleElement = card.querySelector(selector);
                        if (titleElement) break;
                    }
                    
                    for (const selector of companySelectors) {
                        companyElement = card.querySelector(selector);
                        if (companyElement) break;
                    }
                    
                    for (const selector of locationSelectors) {
                        locationElement = card.querySelector(selector);
                        if (locationElement) break;
                    }
                    
                    for (const selector of dateSelectors) {
                        dateElement = card.querySelector(selector);
                        if (dateElement) break;
                    }
                    
                    linkElement = titleElement;
                    
                    const linkSelectors = ['a', '[href]', '.job-search-card__title a', '.job-card__title a'];
                    for (const selector of linkSelectors) {
                        const link = card.querySelector(selector);
                        if (link && link.href) {
                            linkElement = link;
                            break;
                        }
                    }
                    
                    if (titleElement) {
                        const title = titleElement.textContent.trim();
                        let company = companyElement ? companyElement.textContent.trim() : '';
                        const location = locationElement ? locationElement.textContent.trim() : '';
                        const date = dateElement ? dateElement.getAttribute('datetime') || dateElement.textContent.trim() : '';
                        const url = linkElement.href || '';
                        
                        if (!company && url) {
                            const urlMatch = url.match(/\\/jobs\\/view\\/.*?-at-([^?]+)/);
                            if (urlMatch) {
                                company = urlMatch[1].replace(/-/g, ' ').toUpperCase();
                            }
                        }
                        
                        console.log(\`Job \${index + 1}: \${title} - \${company} - \${location}\`);
                        
                        jobs.push({
                            title,
                            company,
                            location,
                            postedDate: date,
                            url,
                            descriptionHtml: ''
                        });
                    }
                } catch (err) {
                    console.log('Erreur parsing job card:', err);
                }
            });
            
            return jobs;
        });
        
        console.log(\`LinkedIn - \${company}: \${jobs.length} offres trouvées\`);
        
        const uniqueJobs = [];
        const seenUrls = new Set();
        const seenTitles = new Set();
        
        jobs.forEach(job => {
            const url = job.url;
            const title = job.title.toLowerCase().trim();
            const jobCompany = job.company.toLowerCase().trim();
            const searchCompany = company.toLowerCase().trim();
            
            const isCorrectCompany = jobCompany.includes(searchCompany) || 
                                   searchCompany.includes(jobCompany) ||
                                   jobCompany === searchCompany;
            
            const isDuplicate = seenUrls.has(url) || seenTitles.has(title);
            
            if (isCorrectCompany && !isDuplicate) {
                seenUrls.add(url);
                seenTitles.add(title);
                uniqueJobs.push(job);
                console.log(\`Offre acceptée: \${job.title} - \${job.company}\`);
            } else if (!isCorrectCompany) {
                console.log(\`Offre ignorée (mauvaise entreprise): \${job.title} - \${job.company} (recherché: \${company})\`);
            } else if (isDuplicate) {
                console.log(\`Doublon ignoré: \${job.title}\`);
            }
        });
        
        console.log(\`LinkedIn - \${company}: \${uniqueJobs.length} offres uniques après déduplication\`);
        
        const formattedJobs = uniqueJobs.map(job => ({
            nom_entreprise: company,
            intitule_poste: job.title,
            lieu: job.location,
            lien: job.url,
            date_publication: job.postedDate || new Date().toISOString().split('T')[0],
            description: job.descriptionHtml,
            plateforme: 'LinkedIn'
        }));
        
        return formattedJobs;
        
    } catch (error) {
        console.log(\`Erreur LinkedIn pour \${company}:\`, error.message);
        return [];
    } finally {
        await page.close();
    }
}

async function main() {
    console.log('=== DÉMARRAGE DU SCRIPT LINKEDIN ===');
    const csvContent = process.argv[2].replace(/\\\\n/g, '\\n');
    const jobId = process.argv[3];
    console.log('JobId:', jobId);
    
    try {
        const companies = parseCsvCompanies(csvContent);
        
        if (!companies.length) {
            const result = {
                success: false,
                error: 'Aucune entreprise trouvée dans le CSV',
                companies: [],
                total_jobs: 0
            };
            console.log(JSON.stringify(result));
            return;
        }
        
        console.log(\`📋 \${companies.length} entreprises trouvées: \${companies.slice(0, 5).join(', ')}\${companies.length > 5 ? '...' : ''}\`);
        
        const browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ],
        });
        
        const allResults = [];
        let totalJobs = 0;
        
        for (let i = 0; i < companies.length; i++) {
            const company = companies[i];
            console.log(\`\\n[\${i + 1}/\${companies.length}] Traitement de \${company}...\`);
            
            const jobs = await getJobsFromLinkedin(browser, company, 'France');
            allResults.push(...jobs);
            totalJobs += jobs.length;
            
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        await browser.close();
        
        const result = {
      success: true,
            job_id: jobId,
            companies: companies,
            total_jobs: totalJobs,
            results: allResults
        };
        
        console.log(\`\\n🎉 Scraping LinkedIn terminé ! \${totalJobs} offres trouvées au total\`);
        console.log(JSON.stringify(result));
        
    } catch (error) {
        const result = {
            success: false,
            error: error.message,
            job_id: jobId
        };
        console.log(JSON.stringify(result));
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
          `

          // Créer un fichier temporaire pour le scraper
          const tempScraperPath = path.join(process.cwd(), 'temp_linkedin_scraper.js')
          fs.writeFileSync(tempScraperPath, linkedinScraperCode)

          // Exécuter le scraper
          const { stdout, stderr } = await execAsync(`node "${tempScraperPath}" "${csvData}" "${jobId}"`)
          
          // Nettoyer le fichier temporaire
          fs.unlinkSync(tempScraperPath)

          if (stderr) {
            console.log('Stderr:', stderr)
          }

          const linkedinResult = JSON.parse(stdout.trim().split('\n').pop() || '{}')
          
          if (linkedinResult.success) {
            // Stocker les résultats en mémoire
            const formattedResults = linkedinResult.results.map((job: any) => ({
              id: `linkedin_${Math.random()}`,
              title: job.intitule_poste || '',
              company: job.nom_entreprise || '',
              location: job.lieu || '',
              date: job.date_publication || '',
              description: job.description || '',
              url: job.lien || '',
              site: 'LinkedIn',
              status: 'NEW',
              scraped_at: new Date().toISOString(),
            }))
            
            allResults.push(...formattedResults)
            totalJobs += formattedResults.length
            
            console.log(`LinkedIn: ${formattedResults.length} offres trouvées`)
          } else {
            console.log('Erreur LinkedIn:', linkedinResult.error)
          }

        } catch (error) {
          console.log('Erreur lors du scraping LinkedIn:', error)
        }
      } else if (site === 'indeed') {
        try {
          console.log('=== DÉMARRAGE DU SCRAPING INDEED ===')
          
          // Créer le scraper Indeed intégré basé sur le script original JobFunnel (version axios/cheerio)
          const indeedScraperCode = `
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

function parseCsvCompanies(csvContent) {
    const companies = [];
    const lines = csvContent.trim().split('\\n');
    
    if (!lines.length) return companies;
    
    const csvLines = lines.slice(1);
    
    csvLines.forEach(line => {
        const parts = line.split(',');
        if (parts.length > 0) {
            const company = parts[0].trim().replace(/"/g, '');
            if (company && company.length > 0 && !companies.includes(company)) {
                companies.push(company);
            }
        }
    });
    
    return companies;
}

async function getJobsFromIndeed(company) {
    try {
        // URL exactement comme dans le script Python original
        const searchUrl = \`https://fr.indeed.com/jobs?q=\${encodeURIComponent(company)}\`;
        
        console.log(\`Indeed - Query: \${company}, url: \${searchUrl}\`);
        
        // User-Agents mobiles exactement comme dans le script Python original
        const mobileUserAgents = [
            'Mozilla/5.0 (Apple-iPhone7C2/1202.466; U; CPU like Mac OS X; en) AppleWebKit/420+ (KHTML, like Gecko) Version/3.0 Mobile/1A543 Safari/419.3 Indeed App 225.0',
            'Mozilla/5.0 (iPhone9,4; U; CPU iPhone OS 10_0_1 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/10.0 Mobile/14A403 Safari/602.1 Indeed App 225.0',
            'Mozilla/5.0 (iPhone9,3; U; CPU iPhone OS 10_0_1 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/10.0 Mobile/14A403 Safari/602.1 Indeed App 225.0',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A5370a Safari/604.1 Indeed App 225.0',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1 Indeed App 225.0',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1 Indeed App 225.0',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/13.2b11866 Mobile/16A366 Safari/605.1.15 Indeed App 225.0',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/69.0.3497.105 Mobile/15E148 Safari/605.1 Indeed App 225.0',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1 Indeed App 225.0',
            'Mozilla/5.0 (iPhone12,1; U; CPU iPhone OS 13_0 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/10.0 Mobile/15E148 Safari/602.1 Indeed App 225.0',
            'Mozilla/5.0 (iPhone13,2; U; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/10.0 Mobile/15E148 Safari/602.1 Indeed App 225.0',
            'Mozilla/5.0 (iPhone14,3; U; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/10.0 Mobile/19A346 Safari/602.1 Indeed App 225.0',
            'Mozilla/5.0 (iPhone14,6; U; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/10.0 Mobile/19E241 Safari/602.1 Indeed App 225.0'
        ];
        
        // Sélectionner un User-Agent aléatoire comme dans le script Python original
        const randomUserAgent = mobileUserAgents[Math.floor(Math.random() * mobileUserAgents.length)];
        
        // Headers exactement comme dans le script Python original
        const headers = {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'accept-encoding': 'gzip, deflate, sdch',
            'accept-language': 'en-GB,en-US;q=0.8,en;q=0.6',
            'referer': 'https://fr.indeed.com/',
            'upgrade-insecure-requests': '1',
            'user-agent': randomUserAgent,
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        };
        
        // Faire la requête HTTP comme dans le script Python original
        const response = await axios.get(searchUrl, { headers });
        console.log('Page Indeed chargée, status:', response.status);
        
        // Parser le HTML avec cheerio (équivalent BeautifulSoup)
        const $ = cheerio.load(response.data);
        
        // Méthode exacte du script Python original: chercher le script mosaic-data
        console.log('Recherche du script mosaic-data...');
        const scriptTag = $('script[id="mosaic-data"]');
        
        if (scriptTag.length === 0) {
            console.log('Script mosaic-data non trouvé');
            return [];
        }
        
        console.log('Script mosaic-data trouvé');
        const scriptContent = scriptTag.html();
        
        // Regex exact du script Python original
        const jsonRegex = /\\["mosaic-provider-jobcards"\\]\\s*=\\s*(\\{.*?\\});/s;
        const match = scriptContent.match(jsonRegex);
        
        if (!match) {
            console.log('Regex match non trouvé dans script mosaic-data');
            return [];
        }
        
        console.log('Regex match trouvé, parsing JSON...');
        
        try {
            const jsonData = JSON.parse(match[1]);
            const jobData = jsonData?.metaData?.mosaicProviderJobCardsModel?.results || [];
            
            console.log(\`\${jobData.length} jobs trouvés dans JSON\`);
            
            const jobs = [];
            jobData.forEach((job, index) => {
                console.log(\`Job \${index + 1}: \${job.displayTitle} - \${job.company} - \${job.formattedLocation}\`);
                
                jobs.push({
                    title: job.displayTitle || '',
                    company: job.company || '',
                    location: job.formattedLocation || '',
                    postedDate: job.formattedRelativeTime || '',
                    url: job.jobkey ? \`https://fr.indeed.com/viewjob?jk=\${job.jobkey}\` : '',
                    descriptionHtml: job.snippet || '',
                    jobkey: job.jobkey || ''
                });
            });
            
            console.log(\`Indeed - \${company}: \${jobs.length} offres trouvées\`);
            
            // Déduplication et filtrage par entreprise
            const uniqueJobs = [];
            const seenUrls = new Set();
            const seenTitles = new Set();
            
            jobs.forEach(job => {
                const url = job.url;
                const title = job.title.toLowerCase().trim();
                const jobCompany = job.company.toLowerCase().trim();
                const searchCompany = company.toLowerCase().trim();
                
                const isCorrectCompany = jobCompany.includes(searchCompany) || 
                                       searchCompany.includes(jobCompany) ||
                                       jobCompany === searchCompany;
                
                const isDuplicate = seenUrls.has(url) || seenTitles.has(title);
                
                if (isCorrectCompany && !isDuplicate) {
                    seenUrls.add(url);
                    seenTitles.add(title);
                    uniqueJobs.push(job);
                    console.log(\`Offre acceptée: \${job.title} - \${job.company}\`);
                } else if (!isCorrectCompany) {
                    console.log(\`Offre ignorée (mauvaise entreprise): \${job.title} - \${job.company} (recherché: \${company})\`);
                } else if (isDuplicate) {
                    console.log(\`Doublon ignoré: \${job.title}\`);
                }
            });
            
            console.log(\`Indeed - \${company}: \${uniqueJobs.length} offres uniques après déduplication\`);
            
            const formattedJobs = uniqueJobs.map(job => ({
                nom_entreprise: company,
                intitule_poste: job.title,
                lieu: job.location,
                lien: job.url,
                date_publication: job.postedDate || new Date().toISOString().split('T')[0],
                description: job.descriptionHtml,
                plateforme: 'Indeed'
            }));
            
            return formattedJobs;
            
        } catch (e) {
            console.log('Erreur parsing JSON mosaic-data:', e);
            return [];
        }
        
  } catch (error) {
        console.log(\`Erreur Indeed pour \${company}:\`, error.message);
        return [];
    }
}

async function main() {
    console.log('=== DÉMARRAGE DU SCRIPT INDEED ===');
    const csvContent = process.argv[2].replace(/\\\\n/g, '\\n');
    const jobId = process.argv[3];
    console.log('JobId:', jobId);
    
    const companies = parseCsvCompanies(csvContent);
    console.log(\`\${companies.length} entreprises trouvées: \${companies.join(', ')}\`);
    
    const allJobs = [];
    
    for (let i = 0; i < companies.length; i++) {
        const company = companies[i];
        console.log(\`[\${i + 1}/\${companies.length}] Traitement de \${company}...\`);
        
        const jobs = await getJobsFromIndeed(company);
        allJobs.push(...jobs);
        
        // Délai entre les requêtes comme dans le script Python original
        if (i < companies.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    console.log(\`Total Indeed: \${allJobs.length} offres trouvées\`);
    
    // Sauvegarder les résultats
    const outputDir = path.join(process.cwd(), 'indeed_results_' + jobId);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputFile = path.join(outputDir, 'indeed_results.jsonl');
    allJobs.forEach(job => {
        fs.appendFileSync(outputFile, JSON.stringify(job) + '\\n');
    });
    
    console.log(\`Résultats sauvegardés dans: \${outputFile}\`);
    
    // Retourner le résultat final
    const result = {
        success: true,
        jobs: allJobs,
        count: allJobs.length,
        outputFile: outputFile
    };
    
    console.log(JSON.stringify(result));
}

if (require.main === module) {
    main();
}
          `

          // Créer un fichier temporaire pour le scraper
          const tempScraperPath = path.join(process.cwd(), 'temp_indeed_scraper.js')
          fs.writeFileSync(tempScraperPath, indeedScraperCode)

          // Exécuter le scraper
          console.log('Exécution du script Indeed...')
          const { stdout, stderr } = await execAsync(`node "${tempScraperPath}" "${csvData}" "${jobId}"`)
          console.log('Script Indeed terminé')
          
          // Nettoyer le fichier temporaire
          fs.unlinkSync(tempScraperPath)

          if (stderr) {
            console.log('Stderr Indeed:', stderr)
          }

          console.log('STDOUT Indeed:', stdout)
          console.log('STDERR Indeed:', stderr)
          
          const indeedResult = JSON.parse(stdout.trim().split('\n').pop() || '{}')
          console.log('Indeed Result:', indeedResult)
          
          if (indeedResult.success) {
            // Stocker les résultats en mémoire
            const formattedResults = indeedResult.jobs.map((job: any) => ({
              id: `indeed_${Math.random()}`,
              title: job.intitule_poste || '',
              company: job.nom_entreprise || '',
              location: job.lieu || '',
              date: job.date_publication || '',
              description: job.description || '',
              url: job.lien || '',
              site: 'Indeed',
              status: 'NEW',
              scraped_at: new Date().toISOString(),
            }))
            
            allResults.push(...formattedResults)
            totalJobs += formattedResults.length
            
            console.log(`Indeed: ${formattedResults.length} offres trouvées`)
          } else {
            console.log('Erreur Indeed:', indeedResult.error)
          }

        } catch (error) {
          console.log('Erreur lors du scraping Indeed:', error)
        }
      } else {
        console.log(`Site non supporté: ${site}`)
      }
    }

    console.log(`Traitement terminé. Total des résultats: ${allResults.length}`)

    // Stocker tous les résultats en mémoire
    storeResults(jobId, allResults)

  return NextResponse.json({
    success: true,
    job: {
      id: jobId,
        sites,
        status: 'completed',
        progress: 100,
        startTime: new Date().toISOString(),
        companyCount: allResults.length > 0 ? 1 : 0
      },
      message: `Scraping terminé : ${totalJobs} offres trouvées sur ${sites.length} site(s)`,
      results: allResults
    })

  } catch (error) {
    console.error('Erreur lors du scraping:', error)
    return NextResponse.json(
      { error: 'Erreur lors du scraping' },
      { status: 500 }
    )
  }
}
