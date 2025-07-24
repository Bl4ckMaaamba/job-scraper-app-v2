// Storage global persistant qui survit aux recompilations Next.js
declare global {
  var __jobResultsStorage: Map<string, any[]> | undefined
}

const globalResultsStorage = globalThis.__jobResultsStorage ?? (globalThis.__jobResultsStorage = new Map<string, any[]>())

export function storeResults(jobId: string, results: any[]) {
  globalResultsStorage.set(jobId, results)
  console.log(`STORAGE - Stockage de ${results.length} résultats pour jobId: ${jobId}`)
  
  // Nettoyer les anciens résultats après 1 heure
  setTimeout(() => {
    globalResultsStorage.delete(jobId)
    console.log(`STORAGE - Nettoyage automatique du jobId: ${jobId}`)
  }, 60 * 60 * 1000)
}

export function getResults(jobId: string): any[] | undefined {
  const results = globalResultsStorage.get(jobId)
  console.log(`STORAGE - Récupération pour jobId: ${jobId}, trouvé: ${results ? results.length : 'aucun'} résultats`)
  return results
}

export function deleteResults(jobId: string) {
  const deleted = globalResultsStorage.delete(jobId)
  console.log(`STORAGE - Suppression du jobId: ${jobId}, succès: ${deleted}`)
  return deleted
}

export function getAllStoredJobIds(): string[] {
  return Array.from(globalResultsStorage.keys())
}

export function clearAllResults() {
  const count = globalResultsStorage.size
  globalResultsStorage.clear()
  console.log(`STORAGE - Nettoyage complet: ${count} jobs supprimés`)
  return count
} 