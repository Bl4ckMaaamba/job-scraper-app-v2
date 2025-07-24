import { NextResponse } from 'next/server'
import { clearAllResults } from '../../../lib/storage'

export async function POST() {
  try {
    const clearedCount = clearAllResults()
    
    console.log(`🧹 API clear-results: ${clearedCount} jobs nettoyés`)
    
    return NextResponse.json({
      success: true,
      message: `${clearedCount} résultats supprimés`,
      clearedCount
    })
  } catch (error) {
    console.error('Erreur lors du nettoyage des résultats:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erreur lors du nettoyage des résultats' 
      },
      { status: 500 }
    )
  }
} 