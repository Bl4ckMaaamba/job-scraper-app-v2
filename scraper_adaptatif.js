const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

class AdaptiveScraper {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    // ÉTAPE 1: Recherche web intelligente
    async findOfficialWebsite(companyName) {
        console.log(`\n🔍 ÉTAPE 1: Recherche intelligente de ${companyName}`);
        
        try {
            const searchQueries = [
                `"${companyName}" site officiel`,
                `${companyName} recrutement emploi`,
                `${companyName} carrière`,
                `${companyName}.com OR ${companyName}.fr`
            ];
            
            for (const query of searchQueries) {
                const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10`;
                console.log(`🌐 Recherche: ${query}`);
                
                const response = await axios.get(searchUrl, {
                    headers: { 'User-Agent': this.userAgent },
                    timeout: 15000
                });
                
                const $ = cheerio.load(response.data);
                const candidates = [];
                
                $('.b_algo h2 a, .b_title a').each((i, el) => {
                    const href = $(el).attr('href');
                    const title = $(el).text().trim();
                    
                    if (href && href.startsWith('http')) {
                        // Filtrer les mauvais domaines
                        const badDomains = [
                            'linkedin.', 'facebook.', 'twitter.', 'wikipedia.',
                            'indeed.', 'glassdoor.', 'monster.', 'pole-emploi.',
                            'societe.com', 'verif.com', 'infogreffe.'
                        ];
                        
                        const isBad = badDomains.some(domain => href.includes(domain));
                        if (!isBad) {
                            candidates.push({ url: href, title, query });
                        }
                    }
                });
                
                // Tester les candidats
                for (const candidate of candidates.slice(0, 3)) {
                    const domain = await this.validateOfficialSite(candidate.url, companyName);
                    if (domain) return domain;
                }
            }
            
            return null;
            
        } catch (error) {
            console.log(`❌ Erreur recherche: ${error.message}`);
            return null;
        }
    }

    async validateOfficialSite(url, companyName) {
        try {
            console.log(`🔗 Test: ${url}`);
            
            const response = await axios.get(url, {
                headers: { 'User-Agent': this.userAgent },
                timeout: 10000,
                httpsAgent: new (require('https')).Agent({ rejectUnauthorized: false })
            });
            
            const $ = cheerio.load(response.data);
            const domain = new URL(url).hostname;
            const pageText = $.text().toLowerCase();
            const pageTitle = $('title').text().toLowerCase();
            
            // Critères de validation multiples
            const companyLower = companyName.toLowerCase();
            
            // 1. Domaine contient le nom
            const domainMatch = domain.toLowerCase().includes(companyLower);
            
            // 2. Contenu contient le nom
            const contentMatch = pageText.includes(companyLower) || pageTitle.includes(companyLower);
            
            // 3. Indicateurs de site officiel
            const officialKeywords = [
                'contact', 'à propos', 'about', 'services', 'accueil',
                'career', 'emploi', 'recrutement', 'société', 'entreprise'
            ];
            const hasOfficialContent = officialKeywords.some(kw => pageText.includes(kw));
            
            // 4. Structure typique d'entreprise
            const hasBusinessStructure = $('nav, header, footer, .menu, .navigation').length > 0;
            
            if ((domainMatch || contentMatch) && hasOfficialContent && hasBusinessStructure) {
                console.log(`✅ Site officiel validé: ${domain}`);
                return domain;
            }
            
        } catch (error) {
            console.log(`❌ Erreur validation ${url}: ${error.message}`);
        }
        
        return null;
    }

    // ÉTAPE 2: Détection avancée des pages emplois
    async findJobsPage(domain) {
        console.log(`\n🔍 ÉTAPE 2: Détection avancée des pages emplois sur ${domain}`);
        
        // URLs étendues avec priorité optimisée
        const jobsUrls = [
            // Priorité 1: Pages standards en français
            `https://${domain}/carriere`, `https://${domain}/carrieres`,
            `https://${domain}/emplois`, `https://${domain}/recrutement`,
            
            // Priorité 2: Variantes avec tirets  
            `https://${domain}/carriere-emplois`, `https://${domain}/carriere-emploi`,
            `https://${domain}/carrieres-emplois`, `https://${domain}/offres-emploi`,
            `https://${domain}/nous-rejoindre`, `https://${domain}/rejoindre`,
            
            // Priorité 3: Anglais
            `https://${domain}/careers`, `https://${domain}/jobs`,
            `https://${domain}/join-us`, `https://${domain}/opportunities`,
            
            // Priorité 4: Sous-domaines
            `https://careers.${domain}`, `https://jobs.${domain}`,
            `https://emploi.${domain}`, `https://recrutement.${domain}`,
            
            // Priorité 5: Autres variantes
            `https://${domain}/rh`, `https://${domain}/hr`,
            `https://${domain}/talent`, `https://${domain}/work`,
        ];
        
        for (const url of jobsUrls) {
            console.log(`🔗 Test: ${url}`);
            
            const pageData = await this.testJobsUrl(url);
            if (pageData) {
                console.log(`✅ Page emplois trouvée: ${url}`);
                return pageData;
            }
            
            await this.sleep(300); // Pause pour éviter le rate limiting
        }
        
        // Si aucune page dédiée, chercher dans le site principal
        console.log(`🔍 Recherche dans le site principal...`);
        return await this.searchJobsInMainSite(domain);
    }

    async testJobsUrl(url) {
        try {
            const response = await axios.get(url, {
                headers: { 'User-Agent': this.userAgent },
                timeout: 8000,
                httpsAgent: new (require('https')).Agent({ rejectUnauthorized: false })
            });
            
            if (response.status === 200) {
                const $ = cheerio.load(response.data);
                const pageText = $.text().toLowerCase();
                
                // Mots-clés pour valider une page emplois
                const jobKeywords = [
                    'emploi', 'job', 'poste', 'carrière', 'recrutement',
                    'candidat', 'offre', 'position', 'opportunité'
                ];
                
                const keywordCount = jobKeywords.filter(kw => pageText.includes(kw)).length;
                
                // Vérifier aussi s'il y a des indicateurs d'offres réelles
                const hasRealJobs = pageText.includes('postuler') || 
                                  pageText.includes('candidature') ||
                                  pageText.includes('cv') ||
                                  pageText.includes('h/f') ||
                                  pageText.includes('cdi') ||
                                  pageText.includes('cdd') ||
                                  $('form').length > 0 ||  // Formulaire de candidature
                                  $('.job, .position, .posting').length > 0; // Éléments d'offres
                
                if (keywordCount >= 2 && (hasRealJobs || keywordCount >= 4)) {
                    return {
                        url,
                        html: response.data,
                        type: this.detectPageType($, response.data)
                    };
                }
            }
        } catch (error) {
            // Essayer HTTP si HTTPS échoue
            if (url.startsWith('https://')) {
                const httpUrl = url.replace('https://', 'http://');
                try {
                    const httpResponse = await axios.get(httpUrl, {
                        headers: { 'User-Agent': this.userAgent },
                        timeout: 8000
                    });
                    
                    if (httpResponse.status === 200) {
                        const $ = cheerio.load(httpResponse.data);
                        const pageText = $.text().toLowerCase();
                        const jobKeywords = ['emploi', 'job', 'poste', 'carrière', 'recrutement'];
                        const keywordCount = jobKeywords.filter(kw => pageText.includes(kw)).length;
                        
                        if (keywordCount >= 2) {
                            return {
                                url: httpUrl,
                                html: httpResponse.data,
                                type: this.detectPageType($, httpResponse.data)
                            };
                        }
                    }
                } catch (httpError) {
                    // Ignorer
                }
            }
        }
        
        return null;
    }

    // Détecter le type de page emplois
    detectPageType($, html) {
        const text = html.toLowerCase();
        
        // Détection AJAX/dynamique
        if (text.includes('ajax') || text.includes('views_dom_id') || 
            text.includes('drupal.settings') || text.includes('load more')) {
            return 'ajax';
        }
        
        // Détection CMS
        if (text.includes('wordpress') || text.includes('wp-content')) {
            return 'wordpress';
        }
        if (text.includes('drupal') || text.includes('drupal.settings')) {
            return 'drupal';
        }
        
        // Page statique classique
        return 'static';
    }

    async searchJobsInMainSite(domain) {
        try {
            const response = await axios.get(`https://${domain}`, {
                headers: { 'User-Agent': this.userAgent },
                timeout: 10000,
                httpsAgent: new (require('https')).Agent({ rejectUnauthorized: false })
            });
            
            const $ = cheerio.load(response.data);
            
            // Chercher des liens vers les emplois
            const jobLinks = [];
            $('a').each((i, el) => {
                const href = $(el).attr('href');
                const text = $(el).text().toLowerCase();
                
                if (href && (
                    text.includes('emploi') || text.includes('carrière') || 
                    text.includes('recrutement') || text.includes('job')
                )) {
                    let fullUrl = href;
                    if (!href.startsWith('http')) {
                        fullUrl = new URL(href, `https://${domain}`).href;
                    }
                    jobLinks.push(fullUrl);
                }
            });
            
            // Tester le premier lien trouvé
            if (jobLinks.length > 0) {
                console.log(`🔗 Lien emploi détecté: ${jobLinks[0]}`);
                return await this.testJobsUrl(jobLinks[0]);
            }
            
        } catch (error) {
            console.log(`❌ Erreur recherche site principal: ${error.message}`);
        }
        
        return null;
    }

    // ÉTAPE 3: Extraction adaptative selon le type de page
    async scrapeJobOffers(pageData, companyName) {
        console.log(`\n🔍 ÉTAPE 3: Extraction adaptative (type: ${pageData.type})`);
        
        switch (pageData.type) {
            case 'ajax':
                return await this.scrapeAjaxJobs(pageData, companyName);
            case 'drupal':
                return await this.scrapeDrupalJobs(pageData, companyName);
            case 'wordpress':
                return await this.scrapeWordPressJobs(pageData, companyName);
            default:
                return await this.scrapeStaticJobs(pageData, companyName);
        }
    }

    // Extraction pour sites AJAX (comme TELMMA)
    async scrapeAjaxJobs(pageData, companyName) {
        console.log(`🔄 Extraction AJAX...`);
        
        const $ = cheerio.load(pageData.html);
        const jobs = [];
        
        // 1. Détecter les vues Drupal AJAX
        const scriptTags = $('script').toArray();
        for (const script of scriptTags) {
            const scriptContent = $(script).html() || '';
            
            // Chercher la configuration Drupal Views AJAX
            const drupalMatch = scriptContent.match(/"views":\s*{[^}]*"ajaxViews":\s*{[^}]*"view_name":"([^"]+)"[^}]*}/);
            if (drupalMatch) {
                const viewName = drupalMatch[1];
                console.log(`🌐 Vue Drupal détectée: ${viewName}`);
                
                try {
                    const ajaxUrl = new URL('/views/ajax', pageData.url).href;
                    console.log(`🔄 Appel AJAX Drupal: ${ajaxUrl}`);
                    
                    const ajaxResponse = await axios.post(ajaxUrl, 
                        `view_name=${viewName}&view_display_id=list`,
                        {
                            headers: { 
                                'User-Agent': this.userAgent,
                                'X-Requested-With': 'XMLHttpRequest',
                                'Content-Type': 'application/x-www-form-urlencoded'
                            },
                            timeout: 10000
                        }
                    );
                    
                    // Parser la réponse AJAX Drupal (format JSON spécial)
                    const ajaxData = ajaxResponse.data;
                    if (Array.isArray(ajaxData)) {
                        for (const command of ajaxData) {
                            if (command.command === 'insert' && command.data) {
                                const htmlData = command.data.replace(/\\u([0-9a-fA-F]{4})/g, 
                                    (match, code) => String.fromCharCode(parseInt(code, 16)));
                                
                                const ajaxJobs = await this.extractJobsFromContent(htmlData, companyName, pageData.url);
                                jobs.push(...ajaxJobs);
                                console.log(`✅ Trouvé ${ajaxJobs.length} offres via AJAX Drupal`);
                            }
                        }
                    }
                    
                } catch (error) {
                    console.log(`❌ Erreur AJAX Drupal: ${error.message}`);
                }
            }
            
            // Chercher d'autres URLs AJAX génériques
            const ajaxUrls = scriptContent.match(/['"](\/[^'"]*(?:ajax|views|emploi)[^'"]*)['"]/g);
            if (ajaxUrls) {
                for (const urlMatch of ajaxUrls) {
                    const cleanUrl = urlMatch.replace(/['"]/g, '');
                    const fullUrl = new URL(cleanUrl, pageData.url).href;
                    
                    console.log(`🔄 Test URL AJAX générique: ${fullUrl}`);
                    
                    try {
                        const ajaxResponse = await axios.get(fullUrl, {
                            headers: { 'User-Agent': this.userAgent },
                            timeout: 8000
                        });
                        
                        const ajaxJobs = await this.extractJobsFromContent(ajaxResponse.data, companyName, fullUrl);
                        jobs.push(...ajaxJobs);
                        
                    } catch (error) {
                        console.log(`❌ Erreur AJAX ${fullUrl}: ${error.message}`);
                    }
                }
            }
        }
        
        // 2. Extraction statique en fallback
        if (jobs.length === 0) {
            console.log(`🔄 Fallback vers extraction statique...`);
            return await this.scrapeStaticJobs(pageData, companyName);
        }
        
        return this.deduplicateJobs(jobs);
    }

    // Extraction pour sites Drupal
    async scrapeDrupalJobs(pageData, companyName) {
        console.log(`🌐 Extraction Drupal...`);
        
        const $ = cheerio.load(pageData.html);
        const jobs = [];
        
        // Sélecteurs spécifiques Drupal
        const drupalSelectors = [
            '.views-row', '.node', '.field-content',
            '.view-content .item', '.drupal-job', '.job-posting'
        ];
        
        for (const selector of drupalSelectors) {
            $(selector).each((i, el) => {
                const job = this.extractJobFromElement($, el, pageData.url, companyName);
                if (job) jobs.push(job);
            });
            
            if (jobs.length > 0) break;
        }
        
        return this.deduplicateJobs(jobs);
    }

    // Extraction pour sites WordPress
    async scrapeWordPressJobs(pageData, companyName) {
        console.log(`📝 Extraction WordPress...`);
        
        const $ = cheerio.load(pageData.html);
        const jobs = [];
        
        // Sélecteurs spécifiques WordPress
        const wpSelectors = [
            '.wp-job', '.job-listing', '.post', '.entry',
            '.job-item', '.career-post', '.position-listing'
        ];
        
        for (const selector of wpSelectors) {
            $(selector).each((i, el) => {
                const job = this.extractJobFromElement($, el, pageData.url, companyName);
                if (job) jobs.push(job);
            });
            
            if (jobs.length > 0) break;
        }
        
        return this.deduplicateJobs(jobs);
    }

    // Extraction pour sites statiques
    async scrapeStaticJobs(pageData, companyName) {
        console.log(`📄 Extraction statique...`);
        
        const $ = cheerio.load(pageData.html);
        let jobs = [];
        
        // 1. Sélecteurs spécifiques aux offres
        const jobSelectors = [
            '.job', '.position', '.posting', '.vacancy', '.opening',
            '.job-listing', '.job-item', '.career-item', '.opportunity',
            '.employment', '.role', '[class*="job"]', '[class*="emploi"]',
            '[class*="career"]', '[class*="position"]'
        ];
        
        for (const selector of jobSelectors) {
            const elements = $(selector);
            if (elements.length > 0) {
                console.log(`🎯 Trouvé ${elements.length} éléments avec: ${selector}`);
                
                elements.each((i, el) => {
                    const job = this.extractJobFromElement($, el, pageData.url, companyName);
                    if (job) jobs.push(job);
                });
                
                if (jobs.length > 0) break;
            }
        }
        
        // 2. Liens vers des pages d'emploi détaillées
        if (jobs.length === 0) {
            console.log(`🔗 Recherche de liens emplois...`);
            
            $('a').each((i, el) => {
                const href = $(el).attr('href');
                const text = $(el).text().trim();
                
                if (href && (
                    href.includes('/emploi/') || href.includes('/job/') || 
                    href.includes('/poste/') || href.includes('/career/')
                )) {
                    let title = this.extractTitleFromUrl(href);
                    if (text && text.length > title.length && this.isValidJobTitle(text)) {
                        title = text;
                    }
                    
                    const fullUrl = href.startsWith('http') ? href : new URL(href, pageData.url).href;
                    
                    jobs.push({
                        title: title,
                        company: companyName,
                        location: '',
                        link: fullUrl,
                        scraped_at: new Date().toISOString()
                    });
                }
            });
        }
        
        // 3. Recherche de contenu textuel
        if (jobs.length === 0) {
            console.log(`📝 Recherche dans le contenu textuel...`);
            jobs = await this.extractJobsFromContent(pageData.html, companyName, pageData.url);
        }
        
        return this.deduplicateJobs(jobs);
    }

    // Extraction de jobs à partir du contenu brut
    async extractJobsFromContent(html, companyName, baseUrl) {
        const $ = cheerio.load(html);
        const jobs = [];
        
        // 1. Chercher dans les structures spécifiques
        
        // Structure TELMMA/Drupal
        $('.field-name-title, .views-field-title, h1, h2, h3').each((i, el) => {
            const title = $(el).text().trim();
            if (this.isValidJobTitle(title)) {
                // Chercher la localisation associée
                let location = '';
                const parent = $(el).closest('.views-row, .field-content, .job-item');
                const locationEl = parent.find('.field-emploi-localisation, .location, .lieu');
                if (locationEl.length) {
                    location = locationEl.text().trim();
                }
                
                // Chercher le lien associé
                let link = baseUrl;
                const linkEl = parent.find('a[href*="emploi"], a[href*="job"], a[href*="poste"]').first();
                if (linkEl.length) {
                    const href = linkEl.attr('href');
                    if (href) {
                        link = href.startsWith('http') ? href : new URL(href, baseUrl).href;
                    }
                }
                
                jobs.push({
                    title: title,
                    company: companyName,
                    location: location,
                    link: link,
                    scraped_at: new Date().toISOString()
                });
            }
        });
        
        // 2. Si pas de résultats, patterns de texte
        if (jobs.length === 0) {
            const jobPatterns = [
                /\b(responsable|manager|directeur|chef|assistant|développeur|ingénieur|technicien|consultant|commercial|comptable|juriste|analyste|spécialiste|expert|chargé|coordinateur|administrateur|gestionnaire)\b[^.!?]{10,80}/gi,
                /\b(stage|alternance|cdi|cdd)\b[^.!?]{10,80}/gi
            ];
            
            const text = $.text();
            
            for (const pattern of jobPatterns) {
                const matches = text.match(pattern);
                if (matches) {
                    matches.forEach(match => {
                        const title = match.trim();
                        if (this.isValidJobTitle(title)) {
                            jobs.push({
                                title: title,
                                company: companyName,
                                location: '',
                                link: baseUrl,
                                scraped_at: new Date().toISOString()
                            });
                        }
                    });
                }
            }
        }
        
        return jobs;
    }

    // Extraction d'un job à partir d'un élément DOM
    extractJobFromElement($, element, baseUrl, companyName) {
        const $el = $(element);
        const text = $el.text().trim();
        
        if (!this.isValidJobTitle(text)) return null;
        
        let title = text.split('\n')[0].trim();
        if (title.length > 100) {
            title = title.substring(0, 100) + '...';
        }
        
        // Extraction du lien
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
        
        // Extraction de la localisation
        const locationRegex = /\b([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ\s-]+)\s*[,\(]?\s*(\d{5})\)?\b/;
        const locationMatch = text.match(locationRegex);
        const location = locationMatch ? locationMatch[0] : '';
        
        return {
            title: title,
            company: companyName,
            location: location,
            link: link,
            scraped_at: new Date().toISOString()
        };
    }

    // Extraire titre depuis URL
    extractTitleFromUrl(url) {
        const parts = url.split('/').filter(p => p.length > 0);
        const lastPart = parts[parts.length - 1];
        return lastPart.replace(/-/g, ' ').replace(/[?#].*/, '').trim();
    }

    // Validation stricte de titre de poste
    isValidJobTitle(text) {
        if (!text || text.length < 5 || text.length > 150) return false;
        
        const textLower = text.toLowerCase();
        
        // Exclusions strictes (contenu marketing/informatif)
        const excludeWords = [
            'voir plus', 'en savoir', 'lire la suite', 'contactez', 'contact',
            'découvrez', 'promouvoir', 'mission', 'vision', 'à propos',
            'recevoir', 'newsletter', 'nos engagements', 'nos valeurs',
            'notre entreprise', 'notre société', 'notre groupe',
            'spécialisé dans', 'intervient', 'tous droits', 'réservés',
            'gestionnaire spécialisé dans l\'immobilier', 
            'responsable de traitement', 'réalise des traitements',
            'données à caractère personnel', 'rgpd', 'protection des données'
        ];
        
        // Vérification d'exclusion avec sous-chaînes
        for (const excludeWord of excludeWords) {
            if (textLower.includes(excludeWord)) {
                return false;
            }
        }
        
        // Exclusion des phrases trop descriptives ou marketing
        if (textLower.includes('immobilier commercial') && textLower.length > 50) {
            return false;
        }
        
        // Inclusions : mots-clés métiers précis
        const jobWords = [
            'responsable', 'manager', 'directeur', 'chef', 'assistant',
            'développeur', 'ingénieur', 'technicien', 'consultant',
            'commercial', 'comptable', 'juriste', 'analyste',
            'spécialiste', 'expert', 'chargé', 'coordinateur',
            'administrateur', 'gestionnaire', 'superviseur'
        ];
        
        // Le titre doit contenir un métier ET être concis
        const hasJobWord = jobWords.some(word => textLower.includes(word));
        const isConcise = text.length < 80 && !textLower.includes('dans') && !textLower.includes('pour');
        
        return hasJobWord && isConcise;
    }

    // Déduplication
    deduplicateJobs(jobs) {
        const unique = [];
        const seen = new Set();
        
        for (const job of jobs) {
            const key = `${job.title.toLowerCase().trim()}-${job.company.toLowerCase()}`;
            if (!seen.has(key) && job.title.length > 5) {
                seen.add(key);
                unique.push(job);
            }
        }
        
        return unique;
    }

    // Utilitaire de pause
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Méthode principale de scraping
    async scrapeCompany(companyName) {
        console.log(`\n🚀 ======== SCRAPING ADAPTATIF ${companyName.toUpperCase()} ========`);
        
        try {
            // ÉTAPE 1: Site officiel
            const domain = await this.findOfficialWebsite(companyName);
            if (!domain) {
                return {
                    company: companyName,
                    status: 'no_website_found',
                    jobs: [],
                    error: 'Site officiel non trouvé'
                };
            }
            
            // ÉTAPE 2: Page emplois
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
            
            // ÉTAPE 3: Extraction adaptative
            const jobs = await this.scrapeJobOffers(jobsPage, companyName);
            
            return {
                company: companyName,
                status: 'success',
                website: domain,
                jobsUrl: jobsPage.url,
                pageType: jobsPage.type,
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

    // Scraping depuis CSV
    async scrapeFromCSV(csvPath) {
        console.log('🧠 SCRAPER ADAPTATIF - SYSTÈME INTELLIGENT');
        console.log('==========================================');
        
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
                
                // Pause entre entreprises
                await this.sleep(2000);
            }
            
            // Sauvegarde
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `scraping-adaptatif-${timestamp}.json`;
            fs.writeFileSync(filename, JSON.stringify(results, null, 2));
            
            console.log(`\n💾 Résultats sauvés: ${filename}`);
            this.displaySummary(results);
            
        } catch (error) {
            console.error('❌ Erreur fatale:', error.message);
        }
    }

    // Affichage du résumé
    displaySummary(results) {
        console.log('\n📊 ======== RÉSUMÉ ADAPTATIF ========');
        
        const successCount = results.filter(r => r.status === 'success').length;
        const totalJobs = results.reduce((sum, r) => sum + r.jobs.length, 0);
        
        console.log(`✅ Entreprises traitées avec succès: ${successCount}/${results.length}`);
        console.log(`📋 Total offres trouvées: ${totalJobs}`);
        
        results.forEach(result => {
            console.log(`\n🏢 ${result.company}:`);
            console.log(`   📊 Status: ${result.status}`);
            if (result.website) console.log(`   🌐 Site: ${result.website}`);
            if (result.jobsUrl) console.log(`   🔗 Page emplois: ${result.jobsUrl}`);
            if (result.pageType) console.log(`   🔧 Type: ${result.pageType}`);
            console.log(`   📝 Offres: ${result.jobs.length}`);
            
            if (result.jobs.length > 0) {
                console.log('   🎯 Offres trouvées:');
                result.jobs.forEach((job, i) => {
                    console.log(`      ${i+1}. ${job.title}`);
                    if (job.location) console.log(`         📍 ${job.location}`);
                    if (job.link) console.log(`         🔗 ${job.link}`);
                });
            }
            
            if (result.error) console.log(`   ❌ ${result.error}`);
        });
        
        console.log('\n🎉 Scraping adaptatif terminé !');
    }
}

// Fonction principale
async function main() {
    const csvPath = process.argv[2] || './test_companies.csv';
    
    if (!fs.existsSync(csvPath)) {
        console.error(`❌ Fichier CSV non trouvé: ${csvPath}`);
        console.log(`💡 Utilisation: node scraper_adaptatif.js votre-fichier.csv`);
        process.exit(1);
    }
    
    const scraper = new AdaptiveScraper();
    await scraper.scrapeFromCSV(csvPath);
}

// Lancer si appelé directement
if (require.main === module) {
    main();
}

module.exports = AdaptiveScraper; 