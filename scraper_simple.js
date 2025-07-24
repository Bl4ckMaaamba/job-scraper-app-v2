const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

class SimpleJobScraper {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    // ÉTAPE 1: Recherche web pour trouver le site officiel
    async findOfficialWebsite(companyName) {
        console.log(`\n🔍 ÉTAPE 1: Recherche du site officiel de ${companyName}`);
        
        try {
            // Recherche sur Bing (plus fiable que Google pour le scraping)
            const searchQuery = encodeURIComponent(`"${companyName}" site officiel`);
            const searchUrl = `https://www.bing.com/search?q=${searchQuery}&count=10`;
            
            console.log(`🌐 Recherche Bing: ${searchQuery}`);
            const response = await axios.get(searchUrl, {
                headers: { 'User-Agent': this.userAgent },
                timeout: 15000
            });
            
            const $ = cheerio.load(response.data);
            const results = [];
            
            // Extraire les liens des résultats Bing
            $('.b_algo h2 a, .b_title a').each((i, el) => {
                const href = $(el).attr('href');
                const title = $(el).text().trim();
                
                if (href && href.startsWith('http') && title) {
                    // Filtrer les sites non pertinents
                    const excludeDomains = [
                        'linkedin.', 'facebook.', 'twitter.', 'wikipedia.',
                        'indeed.', 'glassdoor.', 'monster.', 'pole-emploi.',
                        'pple.fr', 'societe.com', 'verif.com', 'infogreffe.',
                        'lejournaldesentreprises.', 'lesechos.', 'latribune.'
                    ];
                    
                    const isExcluded = excludeDomains.some(domain => href.includes(domain));
                    if (!isExcluded) {
                        results.push({ url: href, title });
                    }
                }
            });
            
            console.log(`📊 ${results.length} sites candidats trouvés`);
            
            // Tester chaque site pour voir s'il correspond à l'entreprise
            for (const result of results.slice(0, 5)) {
                console.log(`🔗 Test: ${result.url}`);
                
                try {
                    const siteResponse = await axios.get(result.url, {
                        headers: { 'User-Agent': this.userAgent },
                        timeout: 10000,
                        httpsAgent: new (require('https')).Agent({ rejectUnauthorized: false })
                    });
                    
                    const sitePage = cheerio.load(siteResponse.data);
                    const pageText = sitePage.text().toLowerCase();
                    const pageTitle = sitePage('title').text().toLowerCase();
                    
                    // Vérifier si c'est le bon site
                    const companyNameLower = companyName.toLowerCase();
                    const domain = new URL(result.url).hostname;
                    
                    // Vérifier si le domaine contient le nom de l'entreprise
                    const domainContainsCompany = domain.toLowerCase().includes(companyNameLower);
                    
                    // Ou si le contenu contient le nom de l'entreprise
                    const hasCompanyName = pageText.includes(companyNameLower) || pageTitle.includes(companyNameLower);
                    
                    // Indicateurs de site officiel (pas annuaire)
                    const officialIndicators = ['contact', 'à propos', 'about', 'services', 'accueil', 'career', 'emploi'];
                    const hasOfficialContent = officialIndicators.some(indicator => pageText.includes(indicator));
                    
                    if ((domainContainsCompany || hasCompanyName) && hasOfficialContent) {
                        console.log(`✅ Site officiel trouvé: ${domain}`);
                        return domain;
                    }
                    
                } catch (error) {
                    console.log(`❌ Erreur ${result.url}: ${error.message}`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            console.log(`❌ Aucun site officiel trouvé pour ${companyName}`);
            return null;
            
        } catch (error) {
            console.log(`❌ Erreur recherche web: ${error.message}`);
            return null;
        }
    }

    // ÉTAPE 2: Trouver la page emplois/carrières
    async findJobsPage(domain) {
        console.log(`\n🔍 ÉTAPE 2: Recherche de la page emplois sur ${domain}`);
        
        // URLs courantes pour les pages emplois
        const jobsUrls = [
            `https://${domain}/carriere-emplois`,   // Variantes avec tirets
            `https://${domain}/carriere-emploi`,
            `https://${domain}/carrieres-emplois`,
            `https://${domain}/carriere`,           // Français standards
            `https://${domain}/carrieres`, 
            `https://${domain}/emplois`,
            `https://${domain}/recrutement`,
            `https://${domain}/careers`,            // Anglais après
            `https://${domain}/jobs`,
            `https://${domain}/nous-rejoindre`,
            `https://${domain}/join-us`,
            `https://careers.${domain}`,
            `https://jobs.${domain}`
        ];
        
        for (const url of jobsUrls) {
            console.log(`🔗 Test: ${url}`);
            
            try {
                const response = await axios.get(url, {
                    headers: { 'User-Agent': this.userAgent },
                    timeout: 10000,
                    httpsAgent: new (require('https')).Agent({ rejectUnauthorized: false })
                });
                
                if (response.status === 200) {
                    const $ = cheerio.load(response.data);
                    const pageText = $.text().toLowerCase();
                    
                    // Vérifier si c'est vraiment une page emplois
                    const jobKeywords = ['emploi', 'job', 'poste', 'carrière', 'recrutement', 'candidat'];
                    const hasJobContent = jobKeywords.some(keyword => pageText.includes(keyword));
                    
                    if (hasJobContent) {
                        console.log(`✅ Page emplois trouvée: ${url}`);
                        return { url, html: response.data };
                    }
                }
                
            } catch (error) {
                if (error.message.includes('SSL') || error.message.includes('EPROTO')) {
                    // Essayer en HTTP si HTTPS échoue
                    const httpUrl = url.replace('https://', 'http://');
                    try {
                        const httpResponse = await axios.get(httpUrl, {
                            headers: { 'User-Agent': this.userAgent },
                            timeout: 10000
                        });
                        
                        if (httpResponse.status === 200) {
                            const $ = cheerio.load(httpResponse.data);
                            const pageText = $.text().toLowerCase();
                            const jobKeywords = ['emploi', 'job', 'poste', 'carrière', 'recrutement'];
                            const hasJobContent = jobKeywords.some(keyword => pageText.includes(keyword));
                            
                            if (hasJobContent) {
                                console.log(`✅ Page emplois trouvée (HTTP): ${httpUrl}`);
                                return { url: httpUrl, html: httpResponse.data };
                            }
                        }
                    } catch (httpError) {
                        // Ignorer l'erreur HTTP
                    }
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log(`❌ Aucune page emplois trouvée sur ${domain}`);
        return null;
    }

    // ÉTAPE 3: Scraper les offres d'emploi
    async scrapeJobOffers(jobsPageData, companyName) {
        console.log(`\n🔍 ÉTAPE 3: Scraping des offres d'emploi`);
        
        const $ = cheerio.load(jobsPageData.html);
        const jobs = [];
        
        console.log(`🔎 Analyse de la page: ${jobsPageData.url}`);
        
        // DEBUG désactivé pour simplifier la sortie
        
        // D'abord chercher des sélecteurs spécifiques aux offres d'emploi
        const specificSelectors = [
            '.job', '.position', '.posting', '.vacancy', '.opening',
            '.job-listing', '.job-item', '.career-item', '.opportunity',
            '.employment', '.roles', '.careers-list',
            '[class*="job"]', '[class*="position"]', '[class*="career"]',
            '[class*="role"]', '[class*="employment"]'
        ];
        
        // Tester les sélecteurs spécifiques d'abord
        for (const selector of specificSelectors) {
            const elements = $(selector);
            if (elements.length > 0) {
                console.log(`🎯 Trouvé ${elements.length} éléments avec: ${selector}`);
                
                elements.each((i, element) => {
                    const job = this.extractJobFromElement($, element, jobsPageData.url, companyName);
                    if (job) jobs.push(job);
                });
                
                if (jobs.length > 0) break;
            }
        }
        
        // Si aucune offre trouvée, chercher dans les liens et textes
        if (jobs.length === 0) {
            console.log(`🔍 Recherche générale dans tous les liens...`);
            
            $('a').each((i, element) => {
                const $el = $(element);
                const text = $el.text().trim();
                const href = $el.attr('href');
                
                // Cas spécial : liens vers des pages d'emploi détaillées
                if (href && (href.includes('/emploi/') || href.includes('/job/') || href.includes('/poste/'))) {
                    console.log(`💼 Lien emploi détecté: ${href}`);
                    
                    let fullLink = href;
                    if (!href.startsWith('http')) {
                        const baseUrl = new URL(jobsPageData.url).origin;
                        fullLink = new URL(href, baseUrl).href;
                    }
                    
                    // Extraire le titre du slug de l'URL
                    const urlParts = href.split('/').filter(part => part.length > 0);
                    let title = urlParts[urlParts.length - 1].replace(/-/g, ' ');
                    title = title.charAt(0).toUpperCase() + title.slice(1);
                    
                    // Si on a un texte plus descriptif, l'utiliser
                    if (text && text !== 'voir le descriptif du poste' && text !== 'postuler' && text.length > 5) {
                        title = text;
                    }
                    
                    jobs.push({
                        title: title,
                        company: companyName,
                        location: '',
                        link: fullLink,
                        scraped_at: new Date().toISOString()
                    });
                }
                // Cas normal : titres de poste dans le texte
                else if (text && href && this.isJobTitle(text)) {
                    console.log(`💼 Candidat: "${text}"`);
                    
                    let fullLink = href;
                    if (!href.startsWith('http')) {
                        const baseUrl = new URL(jobsPageData.url).origin;
                        fullLink = new URL(href, baseUrl).href;
                    }
                    
                    jobs.push({
                        title: text,
                        company: companyName,
                        location: '',
                        link: fullLink,
                        scraped_at: new Date().toISOString()
                    });
                }
            });
        }
        
        // Chercher aussi dans les listes et sections
        if (jobs.length === 0) {
            console.log(`🔍 Recherche dans les listes et sections...`);
            
            $('ul, ol, section, div').each((i, element) => {
                const $el = $(element);
                const text = $el.text().trim();
                
                // Si la section contient des mots-clés emploi
                if (this.hasJobKeywords(text)) {
                    $el.find('li, p, h1, h2, h3, h4, h5, h6').each((j, subElement) => {
                        const job = this.extractJobFromElement($, subElement, jobsPageData.url, companyName);
                        if (job) jobs.push(job);
                    });
                }
            });
        }
        
        // Supprimer les doublons et nettoyer
        const uniqueJobs = [];
        const seenTitles = new Set();
        
        for (const job of jobs) {
            const key = job.title.toLowerCase().trim();
            if (!seenTitles.has(key) && job.title.length > 5 && job.title.length < 150) {
                seenTitles.add(key);
                uniqueJobs.push(job);
            }
        }
        
        console.log(`✅ ${uniqueJobs.length} offres d'emploi trouvées`);
        if (uniqueJobs.length > 0) {
            uniqueJobs.forEach((job, i) => {
                console.log(`   ${i+1}. ${job.title}`);
            });
        }
        
        return uniqueJobs;
    }
    
    // Nouvelle méthode pour extraire une offre d'un élément
    extractJobFromElement($, element, baseUrl, companyName) {
        const $el = $(element);
        const text = $el.text().trim();
        
        if (!this.isJobTitle(text)) return null;
        
        // Extraire le titre (première ligne propre)
        let title = text.split('\n')[0].trim();
        if (title.length > 100) {
            title = title.substring(0, 100) + '...';
        }
        
        // Chercher un lien
        let link = '';
        const $link = $el.find('a').first();
        if ($link.length) {
            const href = $link.attr('href');
            if (href) {
                link = href.startsWith('http') ? href : new URL(href, new URL(baseUrl).origin).href;
            }
        } else if ($el.is('a')) {
            const href = $el.attr('href');
            if (href) {
                link = href.startsWith('http') ? href : new URL(href, new URL(baseUrl).origin).href;
            }
        }
        
        // Chercher la localisation
        let location = '';
        const locationRegex = /([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ\s-]+)\s*[,\(]?\s*(\d{5})\)?/;
        const locationMatch = text.match(locationRegex);
        if (locationMatch) {
            location = locationMatch[0];
        }
        
        return {
            title: title,
            company: companyName,
            location: location,
            link: link,
            scraped_at: new Date().toISOString()
        };
    }
    
    // Vérifier si un texte ressemble à un titre de poste
    isJobTitle(text) {
        if (!text || text.length < 5 || text.length > 150) return false;
        
        const textLower = text.toLowerCase();
        
        // Exclure le contenu marketing/promotionnel
        const excludeKeywords = [
            'promouvoir', 'découvrez', 'engagement', 'valeurs', 'mission',
            'vision', 'stratégie', 'à propos', 'notre', 'entreprise',
            'société', 'groupe', 'histoire', 'savoir plus', 'en savoir',
            'voir plus', 'lire la suite', 'contactez', 'contact'
        ];
        
        if (excludeKeywords.some(keyword => textLower.includes(keyword))) {
            return false;
        }
        
        // Mots-clés positifs pour les postes
        const jobKeywords = [
            'responsable', 'manager', 'directeur', 'chef', 'assistant',
            'développeur', 'ingénieur', 'technicien', 'consultant',
            'commercial', 'comptable', 'juriste', 'analyste',
            'spécialiste', 'expert', 'chargé', 'coordinateur',
            'administrateur', 'gestionnaire', 'superviseur',
            'cdi', 'cdd', 'stage', 'alternance', 'emploi', 'poste'
        ];
        
        return jobKeywords.some(keyword => textLower.includes(keyword));
    }
    
    // Vérifier si une section contient du contenu emploi
    hasJobKeywords(text) {
        const textLower = text.toLowerCase();
        const jobSectionKeywords = [
            'emploi', 'job', 'poste', 'carrière', 'recrutement',
            'candidat', 'opportunité', 'offre', 'position'
        ];
        
        return jobSectionKeywords.some(keyword => textLower.includes(keyword));
    }

    // Scraper principal
    async scrapeCompany(companyName) {
        console.log(`\n🚀 ======== SCRAPING ${companyName.toUpperCase()} ========`);
        
        try {
            // ÉTAPE 1: Trouver le site officiel
            const domain = await this.findOfficialWebsite(companyName);
            if (!domain) {
                return {
                    company: companyName,
                    status: 'no_website_found',
                    jobs: [],
                    error: 'Site officiel non trouvé'
                };
            }
            
            // ÉTAPE 2: Trouver la page emplois
            const jobsPage = await this.findJobsPage(domain);
            if (!jobsPage) {
                return {
                    company: companyName,
                    status: 'no_jobs_page_found',
                    website: domain,
                    jobs: [],
                    error: 'Page emplois non trouvée'
                };
            }
            
            // ÉTAPE 3: Scraper les offres
            const jobs = await this.scrapeJobOffers(jobsPage, companyName);
            
            return {
                company: companyName,
                status: 'success',
                website: domain,
                jobsUrl: jobsPage.url,
                jobs: jobs,
                jobCount: jobs.length
            };
            
        } catch (error) {
            console.log(`❌ Erreur pour ${companyName}: ${error.message}`);
            return {
                company: companyName,
                status: 'error',
                jobs: [],
                error: error.message
            };
        }
    }

    // Lire le CSV et lancer le scraping
    async scrapeFromCSV(csvPath) {
        console.log('🌐 SCRAPER SIMPLE - NOUVEAU SYSTÈME');
        console.log('=====================================');
        
        try {
            const csvContent = fs.readFileSync(csvPath, 'utf8');
            const lines = csvContent.split('\n').filter(line => line.trim());
            const companies = lines.slice(1)
                .map(line => line.split(',')[0].trim())
                .filter(name => name && name !== 'nom_entreprise');
            
            console.log(`📋 ${companies.length} entreprises à traiter:`, companies);
            
            const results = [];
            for (const company of companies) {
                const result = await this.scrapeCompany(company);
                results.push(result);
                
                // Pause entre les entreprises
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            // Sauvegarder les résultats
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `scraping-simple-${timestamp}.json`;
            fs.writeFileSync(filename, JSON.stringify(results, null, 2));
            
            console.log(`\n💾 Résultats sauvés: ${filename}`);
            this.displaySummary(results);
            
        } catch (error) {
            console.error('❌ Erreur fatale:', error.message);
        }
    }

    // Afficher le résumé
    displaySummary(results) {
        console.log('\n📊 ======== RÉSUMÉ ========');
        
        const successCount = results.filter(r => r.status === 'success').length;
        const totalJobs = results.reduce((sum, r) => sum + r.jobs.length, 0);
        
        console.log(`✅ Entreprises traitées avec succès: ${successCount}/${results.length}`);
        console.log(`📋 Total offres trouvées: ${totalJobs}`);
        
        results.forEach(result => {
            console.log(`\n🏢 ${result.company}:`);
            console.log(`   📊 Status: ${result.status}`);
            if (result.website) console.log(`   🌐 Site: ${result.website}`);
            if (result.jobsUrl) console.log(`   🔗 Page emplois: ${result.jobsUrl}`);
            console.log(`   📝 Offres: ${result.jobs.length}`);
            
            if (result.jobs.length > 0) {
                console.log('   🎯 Exemples:');
                result.jobs.slice(0, 3).forEach(job => {
                    console.log(`      • ${job.title}`);
                    if (job.location) console.log(`        📍 ${job.location}`);
                });
            }
            
            if (result.error) console.log(`   ❌ ${result.error}`);
        });
        
        console.log('\n🎉 Scraping terminé !');
    }
}

// Fonction principale
async function main() {
    const csvPath = process.argv[2] || './test_companies.csv';
    
    if (!fs.existsSync(csvPath)) {
        console.error(`❌ Fichier CSV non trouvé: ${csvPath}`);
        console.log(`💡 Utilisation: node scraper_simple.js votre-fichier.csv`);
        process.exit(1);
    }
    
    const scraper = new SimpleJobScraper();
    await scraper.scrapeFromCSV(csvPath);
}

// Lancer si appelé directement
if (require.main === module) {
    main();
}

module.exports = SimpleJobScraper; 