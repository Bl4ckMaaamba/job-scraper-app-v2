const puppeteer = require('puppeteer');

async function testGlassdoorScraper() {
    console.log('=== TEST GLASSDOOR AVEC PUPPETEER ===');
    
    const browser = await puppeteer.launch({
        headless: false, // Pour voir ce qui se passe
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
    
    const page = await browser.newPage();
    
    try {
        console.log('Test avec l\'entreprise: ACCESSITE');
        
        await page.setExtraHTTPHeaders({'accept-language': 'fr-FR,fr;q=0.9'});
        
        const searchUrl = 'https://www.glassdoor.fr/Job/france-ACCESSITE-jobs-SRCH_IL.0,6_IN86.htm';
        
        console.log('URL:', searchUrl);
        
        await page.goto(searchUrl, {waitUntil: 'networkidle2'});
        
        // Attendre que la page se charge
        await page.waitForTimeout(5000);
        
        // Accepter les cookies si popup
        try {
            const acceptBtn = await page.waitForSelector('button[class*="CookieConsent"], button[class*="accept"], button[class*="Accept"]', {timeout: 5000});
            if (acceptBtn) {
                await acceptBtn.click();
                await page.waitForTimeout(1000);
            }
        } catch (e) {
            console.log('Pas de popup cookies');
        }
        
        // Chercher les jobs avec différents sélecteurs
        const jobSelectors = [
            'li[class*="job"]',
            '.job-search-card',
            '.job-card',
            '[data-job-id]',
            '.search-result',
            '.react-job-listing',
            'article[class*="job"]',
            '.listing',
            '.job-listing',
            '.job-result'
        ];
        
        let jobListings = [];
        for (const selector of jobSelectors) {
            try {
                jobListings = await page.$$(selector);
                if (jobListings.length > 0) {
                    console.log(`Jobs trouvés avec ${selector}: ${jobListings.length}`);
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        console.log(`Total jobs trouvés: ${jobListings.length}`);
        
        const jobs = [];
        
        for (let i = 0; i < Math.min(jobListings.length, 5); i++) {
            try {
                const jobElement = jobListings[i];
                
                // Extraire les données
                const title = await jobElement.$eval('a[href*="job"], h2, h3, .title, [data-test-job-title]', el => el.textContent.trim()).catch(() => '');
                const companyName = await jobElement.$eval('.company, .employer, .subtitle, [data-test-job-company]', el => el.textContent.trim()).catch(() => '');
                const location = await jobElement.$eval('.location, .place, [data-test-job-location]', el => el.textContent.trim()).catch(() => '');
                const url = await jobElement.$eval('a[href*="job"]', el => el.href).catch(() => '');
                
                if (title) {
                    jobs.push({
                        title: title,
                        company: companyName || 'ACCESSITE',
                        location: location || 'France',
                        url: url
                    });
                    console.log(`Job ${i + 1}: ${title} - ${companyName || 'ACCESSITE'}`);
                }
            } catch (err) {
                console.log(`Erreur parsing job ${i + 1}:`, err.message);
            }
        }
        
        console.log('\n=== RÉSULTATS ===');
        console.log(`Total offres trouvées: ${jobs.length}`);
        
        jobs.forEach((job, index) => {
            console.log(`\n${index + 1}. ${job.title}`);
            console.log(`   Entreprise: ${job.company}`);
            console.log(`   Lieu: ${job.location}`);
            console.log(`   URL: ${job.url}`);
        });
        
    } catch (error) {
        console.log('Erreur:', error.message);
    } finally {
        await browser.close();
    }
}

testGlassdoorScraper().catch(console.error); 