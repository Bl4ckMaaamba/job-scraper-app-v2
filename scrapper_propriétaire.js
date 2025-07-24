const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

/**
 * SCRAPER HTML POUR SITES PROPRIÉTAIRES D'ENTREPRISES
 * ==================================================
 * 
 * Fonctionnalités:
 * - Trouve automatiquement le site officiel de l'entreprise
 * - Recherche web si le domaine direct ne fonctionne pas
 * - Teste les pages carrières/emplois courantes
 * - Extrait les offres d'emploi avec titre, lien, localisation
 * - Compatible Railway (Axios + Cheerio, pas Puppeteer)
 * - Gestion intelligente des redirections www/non-www
 * - Support multi-langues (français prioritaire)
 * 
 * Utilisation:
 * node html-job-scraper-final.js votre-fichier.csv
 */

class HtmlJobScraper {
    constructor() {
        this.results = [];
        this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    // URLs directes pour les grandes entreprises connues
    getKnownJobsUrl(companyName) {
        const knownUrls = {
            'apple': 'https://jobs.apple.com/en-us/search',
            'google': 'https://careers.google.com/jobs/results/',
            'microsoft': 'https://careers.microsoft.com/v2/global/en/search',
            'amazon': 'https://www.amazon.jobs/fr/search',
            'meta': 'https://www.metacareers.com/jobs',
            'netflix': 'https://jobs.netflix.com/search',
            'tesla': 'https://www.tesla.com/careers/search',
            'salesforce': 'https://careers.salesforce.com/search',
            'adobe': 'https://careers.adobe.com/us/en/search-results',
            'intel': 'https://jobs.intel.com/en/search-jobs',
            'nvidia': 'https://www.nvidia.com/en-us/about-nvidia/careers/',
            'oracle': 'https://careers.oracle.com/jobs/',
            'ibm': 'https://careers.ibm.com/search-jobs',
            'cisco': 'https://jobs.cisco.com/jobs/SearchJobs'
        };
        
        const normalized = companyName.toLowerCase().trim();
        return knownUrls[normalized] || null;
    }

    // Récupérer une page web avec gestion d'erreurs et fallback HTTP
    async fetchPage(url) {
        try {
            console.log(`🌐 Récupération: ${url}`);
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                },
                timeout: 15000,
                maxRedirects: 5,
                httpsAgent: new (require('https')).Agent({
                    rejectUnauthorized: false // Accepter les certificats SSL invalides
                })
            });
            
            if (response.status === 200) {
                console.log(`✅ Page récupérée (${response.data.length} caractères)`);
                return response.data;
            } else {
                console.log(`❌ Status ${response.status} pour ${url}`);
                return null;
            }
        } catch (error) {
            console.log(`⚠️ Erreur HTTPS pour ${url}: ${error.message}`);
            
            // Si erreur SSL, essayer en HTTP
            if (error.message.includes('SSL') || error.message.includes('TLS') || error.message.includes('EPROTO')) {
                const httpUrl = url.replace('https://', 'http://');
                if (httpUrl !== url) {
                    console.log(`🔄 Tentative HTTP: ${httpUrl}`);
                    try {
                        const httpResponse = await axios.get(httpUrl, {
                            headers: {
                                'User-Agent': this.userAgent,
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                                'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
                            },
                            timeout: 15000,
                            maxRedirects: 5
                        });
                        
                        if (httpResponse.status === 200) {
                            console.log(`✅ Page HTTP récupérée (${httpResponse.data.length} caractères)`);
                            return httpResponse.data;
                        }
                    } catch (httpError) {
                        console.log(`❌ Erreur HTTP pour ${httpUrl}: ${httpError.message}`);
                    }
                }
            }
            
            return null;
        }
    }

    // Détecter si une page est parkée ou invalide
    isParkedOrInvalidPage(html, url) {
        if (!html) return true;
        
        const $ = cheerio.load(html);
        const text = $.text().toLowerCase();
        const title = $('title').text().toLowerCase();
        
        // Indicateurs de page parkée
        const parkedIndicators = [
            'domaine en vente', 'domain for sale', 'page parkée', 'parked page',
            'acheter ce domaine', 'buy this domain', 'domaine à vendre',
            'peut-être à vendre', 'might be for sale', 'sedo.com',
            'this domain may be for sale', 'ce domaine est peut-être à vendre'
        ];
        
        // Indicateurs de page d'erreur
        const errorIndicators = [
            'page not found', '404', 'erreur 404', 'site introuvable',
            'coming soon', 'under construction', 'en construction'
        ];
        
        const allIndicators = [...parkedIndicators, ...errorIndicators];
        const isInvalid = allIndicators.some(indicator => 
            text.includes(indicator) || title.includes(indicator)
        );
        
        // Vérifier si la page est trop courte (probable page d'erreur)
        const isToShort = html.length < 1000 && !text.includes('job') && !text.includes('emploi');
        
        return isInvalid || isToShort;
    }

    // Rechercher le site officiel via sources alternatives
    async searchCompanyWebsite(companyName) {
        console.log(`🔍 Recherche multi-sources pour: ${companyName}`);
        
        // 1. Essayer avec Bing (moins restrictif que Google)
        const bingResult = await this.searchWithBing(companyName);
        if (bingResult) return bingResult;
        
        // 2. Essayer avec DuckDuckGo
        const duckResult = await this.searchWithDuckDuckGo(companyName);
        if (duckResult) return duckResult;
        
        // 3. Chercher via annuaires d'entreprises français
        const directoryResult = await this.searchInBusinessDirectories(companyName);
        if (directoryResult) return directoryResult;
        
        console.log(`❌ Aucun site trouvé via toutes les sources pour ${companyName}`);
        return null;
    }

    // Recherche via Bing avec requêtes multiples
    async searchWithBing(companyName) {
        try {
            console.log(`🔍 Recherche Bing pour: ${companyName}`);
            
            // Requêtes progressivement plus spécifiques
            const searchQueries = [
                `"${companyName}" site officiel -pple -verif -societe -infogreffe`,
                `"${companyName}" immobilier "centre commercial" site:*.com OR site:*.fr`,
                `"${companyName}" gestion immobilière France`,
                `"${companyName}" entreprise www.* -annuaire`
            ];
            
            for (const query of searchQueries) {
                console.log(`🌐 Requête Bing: ${query}`);
                
                const searchQuery = encodeURIComponent(query);
                const searchUrl = `https://www.bing.com/search?q=${searchQuery}&count=10`;
                
                const searchHtml = await this.fetchPage(searchUrl);
                if (!searchHtml) continue;
                
                const $ = cheerio.load(searchHtml);
                const results = [];
                
                // Parser les résultats Bing
                $('.b_algo h2 a, .b_title a').each((i, el) => {
                    const $el = $(el);
                    const href = $el.attr('href');
                    const text = $el.text().trim();
                    
                    if (href && href.startsWith('http') && text && !this.isExcludedDomain(href)) {
                        const relevance = this.calculateRelevance(text, href, companyName);
                        if (relevance > 15) { // Seuil plus élevé
                            results.push({ url: href, title: text, relevance });
                        }
                    }
                });
                
                if (results.length > 0) {
                    const result = await this.testSearchResults(results, companyName, 'Bing');
                    if (result) return result;
                }
                
                // Pause entre les requêtes
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            return null;
            
        } catch (error) {
            console.log(`❌ Erreur Bing: ${error.message}`);
            return null;
        }
    }

    // Recherche via DuckDuckGo  
    async searchWithDuckDuckGo(companyName) {
        try {
            console.log(`🔍 Recherche DuckDuckGo pour: ${companyName}`);
            
            const searchQuery = encodeURIComponent(`"${companyName}" entreprise site officiel`);
            const searchUrl = `https://duckduckgo.com/html/?q=${searchQuery}`;
            
            const searchHtml = await this.fetchPage(searchUrl);
            if (!searchHtml) return null;
            
            const $ = cheerio.load(searchHtml);
            const results = [];
            
            // Parser les résultats DuckDuckGo
            $('.result__a, .result-title a').each((i, el) => {
                const $el = $(el);
                const href = $el.attr('href');
                const text = $el.text().trim();
                
                if (href && href.startsWith('http') && text && !this.isExcludedDomain(href)) {
                    const relevance = this.calculateRelevance(text, href, companyName);
                    if (relevance > 10) {
                        results.push({ url: href, title: text, relevance });
                    }
                }
            });
            
            return await this.testSearchResults(results, companyName, 'DuckDuckGo');
            
        } catch (error) {
            console.log(`❌ Erreur DuckDuckGo: ${error.message}`);
            return null;
        }
    }

    // Recherche dans les annuaires d'entreprises
    async searchInBusinessDirectories(companyName) {
        try {
            console.log(`🔍 Recherche annuaires d'entreprises pour: ${companyName}`);
            
            // Liste d'annuaires d'entreprises français
            const directories = [
                `https://www.verif.com/societe/${encodeURIComponent(companyName.toLowerCase())}`,
                `https://www.societe.com/societe/${encodeURIComponent(companyName.toLowerCase())}`,
                `https://www.infogreffe.fr/recherche-siret-entreprise/chercher-siret-entreprise.html?nom=${encodeURIComponent(companyName)}`
            ];
            
            for (const directoryUrl of directories) {
                console.log(`📋 Test annuaire: ${directoryUrl}`);
                
                try {
                    const html = await this.fetchPage(directoryUrl);
                    if (html && !this.isParkedOrInvalidPage(html, directoryUrl)) {
                        const $ = cheerio.load(html);
                        
                        // Chercher des liens vers le site officiel dans la fiche entreprise
                        const websiteLinks = [];
                        $('a[href*="http"]').each((i, el) => {
                            const href = $(el).attr('href');
                            const text = $(el).text().toLowerCase();
                            
                            if (href && 
                                (text.includes('site') || text.includes('web') || text.includes('www') || text.includes('officiel')) &&
                                !this.isExcludedDomain(href)) {
                                websiteLinks.push(href);
                            }
                        });
                        
                        // Tester les liens trouvés
                        for (const link of websiteLinks.slice(0, 3)) {
                            const result = await this.validateCompanySite(link, companyName);
                            if (result) {
                                console.log(`✅ Site trouvé via annuaire: ${link}`);
                                return new URL(link).hostname;
                            }
                        }
                    }
                } catch (error) {
                    console.log(`⚠️ Erreur annuaire ${directoryUrl}: ${error.message}`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            return null;
            
        } catch (error) {
            console.log(`❌ Erreur annuaires: ${error.message}`);
            return null;
        }
    }

    // Tester et valider les résultats de recherche
    async testSearchResults(results, companyName, source) {
        if (results.length === 0) {
            console.log(`❌ Aucun résultat ${source}`);
            return null;
        }
        
        console.log(`📊 ${results.length} résultats ${source} trouvés`);
        
        // Trier par pertinence et tester les 3 meilleurs
        results.sort((a, b) => b.relevance - a.relevance);
        
        for (const result of results.slice(0, 3)) {
            console.log(`🔗 Test ${source}: ${result.url} (score: ${result.relevance})`);
            
            const validSite = await this.validateCompanySite(result.url, companyName);
            if (validSite) {
                console.log(`✅ Site validé via ${source}: ${result.url}`);
                return new URL(result.url).hostname;
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        return null;
    }

    // Valider qu'un site correspond bien à l'entreprise
    async validateCompanySite(url, companyName) {
        try {
            const html = await this.fetchPage(url);
            if (!html || this.isParkedOrInvalidPage(html, url)) {
                console.log(`❌ Site invalide ou parké: ${url}`);
                return false;
            }
            
            const $ = cheerio.load(html);
            const pageText = $.text().toLowerCase();
            const pageTitle = $('title').text().toLowerCase();
            
            // Vérifications strictes du nom de l'entreprise
            const companyNameLower = companyName.toLowerCase();
            const hasCompanyName = pageText.includes(companyNameLower) || pageTitle.includes(companyNameLower);
            
            if (!hasCompanyName) {
                console.log(`❌ Nom entreprise absent: ${url}`);
                return false;
            }
            
            // Vérifier que ce n'est pas un annuaire ou site de presse (double vérification)
            const excludeIndicators = [
                'fiche entreprise', 'données sirene', 'numéro siret', 'code naf',
                'annuaire', 'directory', 'liste entreprises', 'base de données',
                'registre commerce', 'greffe', 'tribunal',
                'publié le', 'article publié', 'dernière mise à jour', 'rédaction',
                'journaliste', 'presse', 'média', 'newsletter', 'abonnement',
                'mentions légales' // souvent présent sur les sites de presse
            ];
            
            const isExcludedSite = excludeIndicators.some(indicator => pageText.includes(indicator));
            if (isExcludedSite) {
                console.log(`❌ Site d'annuaire/presse détecté: ${url}`);
                return false;
            }
            
            // Vérifier les indicateurs de site officiel
            const officialIndicators = [
                'entreprise', 'société', 'company', 'groupe', 'nos services',
                'contact', 'à propos', 'about', 'accueil', 'home',
                'notre équipe', 'mentions légales', 'politique confidentialité'
            ];
            
            const hasOfficialContent = officialIndicators.some(indicator => pageText.includes(indicator));
            
            // Bonus : vérifier la cohérence métier pour ACCESSITE (immobilier)
            const accessiteBusinessIndicators = [
                'immobilier', 'centre commercial', 'retail park', 'gestion',
                'patrimoine', 'asset management', 'property', 'real estate'
            ];
            
            const hasRelevantBusiness = accessiteBusinessIndicators.some(indicator => pageText.includes(indicator));
            
            if (hasOfficialContent && (hasRelevantBusiness || pageText.includes('accessite'))) {
                console.log(`✅ Site validé avec activité cohérente: ${url}`);
                return true;
            } else if (hasOfficialContent) {
                console.log(`⚠️ Site officiel mais activité non cohérente: ${url}`);
                return true; // On garde quand même car c'est un site officiel
            } else {
                console.log(`❌ Pas assez d'indicateurs officiels: ${url}`);
                return false;
            }
            
        } catch (error) {
            console.log(`❌ Erreur validation ${url}: ${error.message}`);
            return false;
        }
    }

    // Vérifier si un domaine doit être exclu
    isExcludedDomain(url) {
        const excludeDomains = [
            'google.', 'youtube.', 'facebook.', 'linkedin.', 'twitter.',
            'instagram.', 'wikipedia.', 'indeed.', 'monster.', 'pole-emploi.',
            'bing.', 'yahoo.', 'duckduckgo.', 'linternaute.', 'journaldunet.',
            'verif.com', 'societe.com', 'infogreffe.fr', 'pple.fr', 'manageo.fr',
            'corporama.com', 'scores-decisions.com', 'bodacc.fr', 'pappers.fr',
            'annuaire-entreprises.data.gouv.fr', 'avis-situation-sirene.insee.fr',
            'lejournaldesentreprises.com', 'lesechos.fr', 'latribune.fr', 'usinenouvelle.com',
            'bfmtv.com', 'franceinfo.fr', 'lefigaro.fr', 'lemonde.fr', 'liberation.fr'
        ];
        
        return excludeDomains.some(domain => url.includes(domain));
    }

    // Calculer la pertinence d'un résultat de recherche
    calculateRelevance(title, url, companyName) {
        let score = 0;
        const titleLower = title.toLowerCase();
        const urlLower = url.toLowerCase();
        const companyLower = companyName.toLowerCase();
        
        // Points pour la présence exacte du nom de l'entreprise
        if (titleLower.includes(companyLower)) score += 25;
        if (urlLower.includes(companyLower)) score += 30;
        
        // Bonus spécial pour ACCESSITE + activité immobilière
        if (companyLower === 'accessite') {
            const accessiteKeywords = ['immobilier', 'centre commercial', 'retail park', 'gestion', 'asset management'];
            accessiteKeywords.forEach(keyword => {
                if (titleLower.includes(keyword)) score += 15;
                if (urlLower.includes(keyword)) score += 10;
            });
        }
        
        // Points pour les mots-clés business/entreprise
        const businessKeywords = ['société', 'entreprise', 'company', 'groupe', 'sas', 'sarl'];
        businessKeywords.forEach(keyword => {
            if (titleLower.includes(keyword)) score += 8;
            if (urlLower.includes(keyword)) score += 5;
        });
        
        // Points pour les mots-clés emploi
        const jobKeywords = ['emploi', 'job', 'carrière', 'career', 'recrutement', 'hiring'];
        jobKeywords.forEach(keyword => {
            if (titleLower.includes(keyword)) score += 6;
            if (urlLower.includes(keyword)) score += 4;
        });
        
        // Bonus pour les domaines officiels
        if (urlLower.includes('.com') || urlLower.includes('.fr')) score += 5;
        if (urlLower.includes('.org') || urlLower.includes('.net')) score += 2;
        
        // Bonus pour les indicateurs de site officiel
        const officialIndicators = ['officiel', 'official', 'www.'];
        officialIndicators.forEach(indicator => {
            if (titleLower.includes(indicator) || urlLower.includes(indicator)) score += 8;
        });
        
        // Pénalités TRÈS fortes pour les annuaires, presse et sites non pertinents
        const strongPenalties = [
            'fiche entreprise', 'données sirene', 'annuaire', 'directory',
            'pple.fr', 'manageo', 'verif.com', 'societe.com', 'infogreffe',
            'journal', 'presse', 'média', 'actualité', 'news', 'article',
            'lesechos', 'latribune', 'usinenouvelle', 'bfmtv', 'franceinfo'
        ];
        strongPenalties.forEach(penalty => {
            if (titleLower.includes(penalty) || urlLower.includes(penalty)) score -= 50;
        });
        
        // Pénalités normales
        const penalties = [
            'forum', 'blog', 'news', 'actualité', 'avis', 'review', 
            'prix', 'tarif', 'comparateur', 'comparatif'
        ];
        penalties.forEach(penalty => {
            if (titleLower.includes(penalty) || urlLower.includes(penalty)) score -= 10;
        });
        
        return Math.max(0, score); // Score minimum de 0
    }



    // Tester les pages carrières sur un site spécifique
    async tryJobsPagesOnWebsite(websiteDomain, companyName) {
        console.log(`🔍 Test des pages carrières sur: ${websiteDomain}`);
        
        // URLs courantes pour les pages carrières (français prioritaire)
        const commonPaths = [
            `https://${websiteDomain}/carriere`,
            `https://${websiteDomain}/carrieres`, 
            `https://${websiteDomain}/carriere-emplois`,
            `https://${websiteDomain}/carrieres-emplois`,
            `https://${websiteDomain}/emploi`,
            `https://${websiteDomain}/emplois`,
            `https://${websiteDomain}/recrutement`,
            `https://${websiteDomain}/nous-rejoindre`,
            `https://${websiteDomain}/rejoindre`,
            `https://${websiteDomain}/careers`,
            `https://${websiteDomain}/jobs`,
            `https://${websiteDomain}/join-us`,
            `https://careers.${websiteDomain.replace('www.', '')}`,
            `https://jobs.${websiteDomain.replace('www.', '')}`
        ];
        
        for (const url of commonPaths) {
            console.log(`🔗 Test: ${url}`);
            const html = await this.fetchPage(url);
            
            if (html) {
                const $ = cheerio.load(html);
                const text = $.text().toLowerCase();
                
                // Vérifier si la page contient des offres d'emploi
                const jobKeywords = ['poste', 'emploi', 'job', 'position', 'career', 'recrutement', 'offre'];
                const hasJobs = jobKeywords.some(keyword => text.includes(keyword));
                
                if (hasJobs) {
                    console.log(`✅ Page carrière trouvée: ${url}`);
                    return { url, html };
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        return null;
    }

    // Trouver l'URL des offres d'emploi d'une entreprise
    async findCompanyJobsUrl(companyName) {
        // 1. Essayer les URLs connues des grandes entreprises
        const knownUrl = this.getKnownJobsUrl(companyName);
        if (knownUrl) {
            console.log(`📍 URL directe connue: ${knownUrl}`);
            const html = await this.fetchPage(knownUrl);
            return html ? { url: knownUrl, html } : null;
        }

        // 2. Recherche directe sur Google pour trouver le site officiel
        console.log(`🔍 Recherche Google directe pour: ${companyName}`);
        const companyWebsite = await this.searchCompanyWebsite(companyName);
        
        if (companyWebsite) {
            // 3. Tester les pages carrières sur le site trouvé
            const jobsResult = await this.tryJobsPagesOnWebsite(companyWebsite, companyName);
            if (jobsResult) return jobsResult;
        }

        console.log(`❌ Aucune page emploi trouvée pour ${companyName}`);
        return null;
    }

    // Extraire les offres d'emploi du HTML
    async extractJobsFromHtml($, companyName, url) {
        console.log(`📄 Extraction des offres pour: ${companyName}`);
        
        let foundJobs = [];
        
        // Méthode 1: Sélecteurs CSS classiques
        const selectors = [
            '.job', '.position', '.role', '.posting', '.vacancy', '.opening',
            '.job-listing', '.job-item', '.career-item', '.opportunity',
            '[data-job]', '[data-role]', '[data-position]',
            '[class*="job"]', '[class*="position"]', '[class*="career"]'
        ];
        
        for (const selector of selectors) {
            $(selector).each((i, el) => {
                const $el = $(el);
                
                // Extraire le titre
                let title = '';
                const titleSelectors = ['h1', 'h2', 'h3', '.title', '.job-title', 'a', 'strong'];
                
                for (const titleSel of titleSelectors) {
                    const titleEl = $el.find(titleSel).first();
                    if (titleEl.length && titleEl.text().trim()) {
                        title = titleEl.text().trim();
                        break;
                    }
                }
                
                if (!title) {
                    title = $el.text().split('\n')[0]?.trim() || '';
                }
                
                if (title.length > 10 && title.length < 200) {
                    // Extraire le lien
                    let link = '';
                    const linkEl = $el.find('a').first();
                    if (linkEl.length) {
                        link = linkEl.attr('href') || '';
                        if (link && !link.startsWith('http')) {
                            const baseUrl = new URL(url).origin;
                            link = new URL(link, baseUrl).href;
                        }
                    }
                    
                    // Extraire la localisation
                    let location = '';
                    const locationSelectors = ['.location', '.job-location', '[class*="location"]'];
                    for (const locSel of locationSelectors) {
                        const locEl = $el.find(locSel).first();
                        if (locEl.length) {
                            location = locEl.text().trim();
                            break;
                        }
                    }
                    
                    foundJobs.push({
                        title: title,
                        link: link,
                        location: location,
                        company: companyName
                    });
                }
            });
            
            if (foundJobs.length > 0) break;
        }
        
        // Méthode 2: Recherche par mots-clés si rien trouvé
        if (foundJobs.length === 0) {
            console.log('🎯 Recherche par mots-clés...');
            
            const jobKeywords = [
                'responsable', 'assistant', 'assistante', 'manager', 'directeur', 'directrice',
                'chef', 'développeur', 'développeuse', 'ingénieur', 'ingénieure',
                'technicien', 'technicienne', 'consultant', 'consultante',
                'commercial', 'commerciale', 'marketing', 'comptable',
                'spécialiste', 'expert', 'experte', 'chargé', 'chargée'
            ];
            
            const candidates = [];
            
            $('*').each((i, el) => {
                const $el = $(el);
                const text = $el.text().trim();
                const textLower = text.toLowerCase();
                
                // Chercher les éléments contenant des mots-clés de métier
                const hasJobKeyword = jobKeywords.some(keyword => textLower.includes(keyword));
                
                if (hasJobKeyword && text.length > 15 && text.length < 150) {
                    // Éviter le texte générique
                    const excludeWords = [
                        'nous sommes', 'nous recherchons', 'rejoignez', 'découvrez',
                        'cliquez', 'voir plus', 'en savoir plus', 'postuler'
                    ];
                    
                    const isGenericText = excludeWords.some(exclude => textLower.includes(exclude));
                    const hasLotsOfWords = text.split(' ').length > 10;
                    
                    if (!isGenericText && !hasLotsOfWords) {
                        candidates.push({
                            element: $el,
                            title: text
                        });
                    }
                }
            });
            
            // Prendre les 10 meilleurs candidats
            candidates.slice(0, 10).forEach(candidate => {
                const $el = candidate.element;
                const title = candidate.title;
                
                // Chercher lien
                let link = '';
                const $linkEl = $el.closest('a');
                if ($linkEl.length) {
                    link = $linkEl.attr('href') || '';
                    if (link && !link.startsWith('http')) {
                        const baseUrl = new URL(url).origin;
                        link = new URL(link, baseUrl).href;
                    }
                }
                
                // Chercher localisation dans les éléments proches
                let location = '';
                const $parent = $el.parent();
                const $siblings = $el.siblings();
                
                $siblings.add($parent).each((i, searchEl) => {
                    const searchText = $(searchEl).text().trim();
                    
                    // Détecter ville + code postal français
                    const locationRegex = /([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ\s-]+)\s*[,\(]?\s*(\d{5})\)?/;
                    const match = searchText.match(locationRegex);
                    
                    if (match && searchText.length < 50) {
                        location = searchText.trim();
                        return false; // break
                    }
                });
                
                foundJobs.push({
                    title: title,
                    link: link,
                    location: location,
                    company: companyName
                });
            });
        }
        
        // Supprimer les doublons
        const uniqueJobs = [];
        const seenTitles = new Set();
        
        for (const job of foundJobs) {
            const key = job.title.toLowerCase().trim();
            if (!seenTitles.has(key) && job.title) {
                seenTitles.add(key);
                uniqueJobs.push(job);
            }
        }
        
        console.log(`✅ ${uniqueJobs.length} offres trouvées`);
        return uniqueJobs;
    }

    // Traiter une entreprise
    async scrapeCompany(companyName) {
        console.log(`\n🏢 ======== ${companyName.toUpperCase()} ========`);
        
        try {
            // Trouver l'URL et récupérer le HTML
            const result = await this.findCompanyJobsUrl(companyName);
            if (!result) {
                return {
                    company: companyName,
                    status: 'no_jobs_page_found',
                    jobs: [],
                    error: 'Page d\'offres non trouvée'
                };
            }

            const { url, html } = result;
            const $ = cheerio.load(html);
            
            // Extraire les offres
            const jobs = await this.extractJobsFromHtml($, companyName, url);
            
            return {
                company: companyName,
                status: jobs.length > 0 ? 'success' : 'no_jobs_found',
                jobsUrl: url,
                jobs: jobs.map(job => ({
                    ...job,
                    scraped_at: new Date().toISOString()
                })),
                jobCount: jobs.length
            };

        } catch (error) {
            console.error(`❌ Erreur pour ${companyName}:`, error);
            return {
                company: companyName,
                status: 'error',
                jobs: [],
                error: error.message
            };
        }
    }

    // Lire le fichier CSV
    readCompaniesFromCSV(csvPath) {
        try {
            const csvContent = fs.readFileSync(csvPath, 'utf8');
            const lines = csvContent.split('\n').filter(line => line.trim());
            const companies = lines.slice(1) // Ignorer l'en-tête
                .map(line => line.trim())
                .filter(name => name)
                .map(line => line.split(',')[0].trim()) // Prendre la première colonne
                .filter(name => name && name !== 'nom_entreprise');
            
            console.log(`📋 ${companies.length} entreprises trouvées:`, companies);
            return companies;
        } catch (error) {
            console.error('❌ Erreur lecture CSV:', error);
            return [];
        }
    }

    // Lancer le scraping depuis un fichier CSV
    async scrapeFromCSV(csvPath) {
        console.log('🌐 SCRAPER HTML SITES PROPRIÉTAIRES');
        console.log('===================================\n');
        
        const companies = this.readCompaniesFromCSV(csvPath);
        if (companies.length === 0) {
            console.log('❌ Aucune entreprise trouvée dans le CSV');
            return;
        }
        
        for (const company of companies) {
            const result = await this.scrapeCompany(company);
            this.results.push(result);
            
            // Pause entre les entreprises pour éviter la surcharge
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        await this.saveResults();
        this.displaySummary();
    }

    // Sauvegarder les résultats
    async saveResults() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `scraping-propriétaire-${timestamp}.json`;
        
        fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));
        console.log(`💾 Résultats sauvés: ${filename}`);
    }

    // Afficher le résumé des résultats
    displaySummary() {
        console.log('\n📊 ======== RÉSUMÉ ========');
        
        const successCount = this.results.filter(r => r.status === 'success').length;
        const totalJobs = this.results.reduce((sum, r) => sum + r.jobs.length, 0);
        
        console.log(`✅ Entreprises avec offres: ${successCount}/${this.results.length}`);
        console.log(`📋 Total offres trouvées: ${totalJobs}`);
        
        this.results.forEach(result => {
            console.log(`\n🏢 ${result.company}:`);
            console.log(`   📊 Status: ${result.status}`);
            if (result.jobsUrl) console.log(`   🔗 URL: ${result.jobsUrl}`);
            console.log(`   📝 Offres: ${result.jobs.length}`);
            
            if (result.jobs.length > 0) {
                console.log('   🎯 Exemples:');
                result.jobs.slice(0, 3).forEach(job => {
                    console.log(`      • ${job.title}`);
                    if (job.location) console.log(`        📍 ${job.location}`);
                });
                if (result.jobs.length > 3) {
                    console.log(`      ... et ${result.jobs.length - 3} autres`);
                }
            }
            
            if (result.error) console.log(`   ❌ ${result.error}`);
        });
        
        console.log('\n🎉 Scraping terminé !');
    }
}

// Fonction principale
async function main() {
    const csvPath = process.argv[2] || './exemple-entreprises.csv';
    
    if (!fs.existsSync(csvPath)) {
        console.error(`❌ Fichier CSV non trouvé: ${csvPath}`);
        console.log(`💡 Utilisation: node html-job-scraper-final.js votre-fichier.csv`);
        process.exit(1);
    }
    
    const scraper = new HtmlJobScraper();
    
    try {
        await scraper.scrapeFromCSV(csvPath);
    } catch (error) {
        console.error('❌ Erreur fatale:', error);
        process.exit(1);
    }
}

// Lancer si appelé directement
if (require.main === module) {
    main();
}

module.exports = HtmlJobScraper; 