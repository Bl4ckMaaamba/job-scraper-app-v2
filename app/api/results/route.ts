import { NextRequest, NextResponse } from 'next/server'
import { getResults, storeResults, deleteResults } from '../../../lib/storage'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('jobId')

  if (!jobId) {
    return NextResponse.json({ success: false, error: 'Job ID requis' }, { status: 400 })
  }

  try {
    // Vérifier si les résultats sont en mémoire
    const storedResults = getResults(jobId)
    
    if (storedResults) {
      return NextResponse.json({
        success: true,
        results: storedResults,
        count: storedResults.length,
        source: 'LinkedIn Scraper',
        summary: {
          totalCompanies: 1,
          totalJobs: storedResults.length
        }
      })
    }

    // Si pas en mémoire, retourner un tableau vide
    return NextResponse.json({
      success: true,
      results: [],
      count: 0,
      source: 'LinkedIn Scraper',
      summary: {
        totalCompanies: 0,
        totalJobs: 0
      }
    })

  } catch (error) {
    console.error('Erreur lors de la récupération des résultats:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Erreur lors de la récupération des résultats' 
    }, { status: 500 })
  }
}

// Note: storeResults est maintenant dans lib/storage.ts
