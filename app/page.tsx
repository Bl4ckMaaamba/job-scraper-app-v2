"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Upload,
  Download,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Settings,
  Target,
  Activity,
  FileText,
  CheckCircle,
  AlertCircle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ScrapingJob {
  id: string
  sites: string[]
  interval: number
  status: "idle" | "running" | "paused" | "completed" | "error"
  progress: number
  currentSite?: string
  startTime?: Date
  results?: any[]
}

const SCRAPING_SITES = [
  { id: "indeed", name: "Indeed", color: "bg-blue-600" },
  { id: "linkedin", name: "LinkedIn", color: "bg-blue-700" },
  { id: "proprietary", name: "Scraper Adaptatif", color: "bg-emerald-600" },
]

const INTERVAL_OPTIONS = [
  { value: 5, label: "5 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 heure" },
  { value: 120, label: "2 heures" },
  { value: 360, label: "6 heures" },
  { value: 720, label: "12 heures" },
  { value: 1440, label: "24 heures" },
]

export default function JobScraperApp() {
  const [selectedSites, setSelectedSites] = useState<string[]>([])
  const [interval, setIntervalMinutes] = useState<number>(60)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvContent, setCsvContent] = useState<string>("")
  const [currentJob, setCurrentJob] = useState<ScrapingJob | null>(null)
  const [autoMode, setAutoMode] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  // Charger les données depuis localStorage après hydratation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSites = localStorage.getItem('selectedSites')
      const savedInterval = localStorage.getItem('interval')
      const savedCsvContent = localStorage.getItem('csvContent')
      const savedCurrentJob = localStorage.getItem('currentJob')
      const savedAutoMode = localStorage.getItem('autoMode')

      if (savedSites) setSelectedSites(JSON.parse(savedSites))
      if (savedInterval) setIntervalMinutes(parseInt(savedInterval))
      if (savedCsvContent) setCsvContent(savedCsvContent)
      if (savedCurrentJob) setCurrentJob(JSON.parse(savedCurrentJob))
      if (savedAutoMode) setAutoMode(JSON.parse(savedAutoMode))
      
      setIsHydrated(true)
    }
  }, [])
  const { toast } = useToast()

  // Fonctions pour sauvegarder dans localStorage
  const saveToLocalStorage = (key: string, value: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value))
    }
  }

  const resetApplication = () => {
    setSelectedSites([])
    setIntervalMinutes(60)
    setCsvFile(null)
    setCsvContent("")
    setCurrentJob(null)
    setAutoMode(false)
    
    // Nettoyer localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('selectedSites')
      localStorage.removeItem('interval')
      localStorage.removeItem('csvContent')
      localStorage.removeItem('currentJob')
      localStorage.removeItem('autoMode')
    }
    
    toast({
      title: "Application réinitialisée",
      description: "Toutes les données ont été effacées",
    })
  }

  const simulateProgress = (job: ScrapingJob) => {
    const totalSteps = job.sites.length * 20
    let currentStep = 0
    let currentSiteIndex = 0

    // @ts-ignore
    const progressInterval = setInterval(() => {
      if (job.status !== "running") {
        // @ts-ignore
        clearInterval(progressInterval)
        return
      }

      currentStep++
      const progress = Math.min((currentStep / totalSteps) * 100, 100)

      if (currentStep % 20 === 0 && currentSiteIndex < job.sites.length - 1) {
        currentSiteIndex++
      }

      const updatedJob = {
        ...job,
        progress,
        currentSite: job.sites[currentSiteIndex],
      }

      setCurrentJob(updatedJob)

      if (progress >= 100) {
        clearInterval(progressInterval)
        const completedJob = {
          ...updatedJob,
          status: "completed" as const,
          progress: 100,
          results: generateMockResults(job.sites.length),
        }
        setCurrentJob(completedJob)

        toast({
          title: "Scraping terminé",
          description: `${completedJob.results?.length} offres d'emploi collectées avec succès`,
        })
      }
    }, 200)
  }

  const generateMockResults = (siteCount: number) => {
    const results = []
    const jobTitles = [
      "Développeur Frontend",
      "Développeur Backend",
      "Développeur Full Stack",
      "Ingénieur DevOps",
      "Data Scientist",
      "UX/UI Designer",
      "Product Manager",
    ]
    const companies = ["TechCorp", "InnovateLab", "StartupXYZ", "MegaTech", "CodeFactory", "DigitalWorks", "FutureTech"]
    const locations = ["Paris", "Lyon", "Marseille", "Toulouse", "Nantes", "Bordeaux", "Lille"]

    for (let i = 0; i < siteCount * 15; i++) {
      results.push({
        id: `job_${i}`,
        title: jobTitles[i % jobTitles.length],
        company: companies[i % companies.length],
        location: locations[i % locations.length],
        salary: `${30 + (i % 20)}k - ${50 + (i % 30)}k €`,
        site: SCRAPING_SITES[i % SCRAPING_SITES.length].name,
        url: `https://example.com/job/${i}`,
        description: `Description du poste ${i}...`,
        scraped_at: new Date().toISOString(),
      })
    }
    return results
  }

  const handleSiteToggle = (siteId: string) => {
    setSelectedSites((prev) => (prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]))
  }

  const handleSelectAll = () => {
    if (selectedSites.length === SCRAPING_SITES.length) {
      setSelectedSites([])
    } else {
      setSelectedSites(SCRAPING_SITES.map((site) => site.id))
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === "text/csv") {
      setCsvFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setCsvContent(content)
        toast({
          title: "Fichier CSV chargé",
          description: `${content.split("\n").length - 1} entreprises détectées`,
        })
      }
      reader.readAsText(file)
    } else {
      toast({
        title: "Erreur de fichier",
        description: "Veuillez sélectionner un fichier CSV valide",
        variant: "destructive",
      })
    }
  }

  const startScraping = async () => {
    if (selectedSites.length === 0) {
      toast({
        title: "Sélection requise",
        description: "Veuillez sélectionner au moins un site à scraper",
        variant: "destructive",
      })
      return
    }

    if (!csvFile) {
      toast({
        title: "Fichier requis",
        description: "Veuillez charger un fichier CSV d'entreprises",
        variant: "destructive",
      })
      return
    }

    const newJob: ScrapingJob = {
      id: `job_${Date.now()}`,
      sites: selectedSites,
      interval,
      status: "running",
      progress: 0,
      startTime: new Date(),
    }

    setCurrentJob(newJob)

    try {
      // Lancer le scraping via l'API
      const response = await fetch("/api/scraping", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sites: selectedSites,
          csvData: csvContent,
          interval,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Mettre à jour le job avec les informations de l'API
        const updatedJob = {
          ...newJob,
          id: data.job?.id || newJob.id,
          status: data.job?.status || "running",
          progress: data.job?.progress || 0,
        }
        setCurrentJob(updatedJob)
        
        if (data.job?.status === "completed") {
          // Le scraping est déjà terminé, récupérer les résultats
          await checkResults(updatedJob.id)
        }

        toast({
          title: data.job?.status === "completed" ? "Scraping terminé" : "Scraping démarré",
          description: data.message || `Collecte en cours sur ${selectedSites.length} plateforme(s)`,
        })

      } else {
        toast({
          title: "Erreur",
          description: data.error || "Erreur lors du démarrage du scraping",
          variant: "destructive",
        })
        setCurrentJob({ ...newJob, status: "error" })
      }
    } catch (error) {
      console.error("Erreur lors du scraping:", error)
      toast({
        title: "Erreur",
        description: "Erreur lors du démarrage du scraping",
        variant: "destructive",
      })
      setCurrentJob({ ...newJob, status: "error" })
    }
  }

  const pauseScraping = () => {
    if (currentJob) {
      setCurrentJob({ ...currentJob, status: "paused" })
      toast({
        title: "Scraping en pause",
        description: "Le processus a été mis en pause",
      })
    }
  }

  const resumeScraping = () => {
    if (currentJob) {
      const resumedJob = { ...currentJob, status: "running" as const }
      setCurrentJob(resumedJob)
      simulateProgress(resumedJob)
      toast({
        title: "Scraping repris",
        description: "Le processus a repris",
      })
    }
  }

  const stopScraping = () => {
    if (currentJob) {
      setCurrentJob({ ...currentJob, status: "idle", progress: 0 })
      toast({
        title: "Scraping arrêté",
        description: "Le processus a été interrompu",
      })
    }
  }

  const checkResults = async (jobId: string) => {
    try {
      const response = await fetch(`/api/results?jobId=${jobId}`)
      const data = await response.json()

      if (data.success) {
        const completedJob = {
          ...currentJob!,
          status: "completed" as const,
          progress: 100,
          results: data.results || [],
        }
        setCurrentJob(completedJob)

        toast({
          title: "Scraping terminé",
          description: `${data.results?.length || 0} offres d'emploi collectées avec succès`,
        })
      } else {
        // Si pas encore de résultats, réessayer dans 10 secondes
        setTimeout(() => checkResults(jobId), 10000)
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des résultats:", error)
      // Réessayer dans 10 secondes en cas d'erreur
      setTimeout(() => checkResults(jobId), 10000)
    }
  }

  const downloadResults = (job: ScrapingJob) => {
    if (job.results) {
      const dataStr = JSON.stringify(job.results, null, 2)
      const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr)

      const exportFileDefaultName = `job_results_${new Date().toISOString().split("T")[0]}.json`

      const linkElement = document.createElement("a")
      linkElement.setAttribute("href", dataUri)
      linkElement.setAttribute("download", exportFileDefaultName)
      linkElement.click()

      toast({
        title: "Téléchargement initié",
        description: "Le fichier de résultats a été téléchargé",
      })
    }
  }

  // Sauvegarder automatiquement dans localStorage
  useEffect(() => {
    saveToLocalStorage('selectedSites', selectedSites)
  }, [selectedSites])

  useEffect(() => {
    saveToLocalStorage('interval', interval)
  }, [interval])

  useEffect(() => {
    saveToLocalStorage('csvContent', csvContent)
  }, [csvContent])

  useEffect(() => {
    saveToLocalStorage('currentJob', currentJob)
  }, [currentJob])



  useEffect(() => {
    saveToLocalStorage('autoMode', autoMode)
  }, [autoMode])

  const startAutomaticScraping = async () => {
    try {
      // Nettoyer les anciens résultats avant chaque exécution automatique
      const response = await fetch("/api/clear-results", { method: "POST" })
      if (response.ok) {
        console.log("🔄 Mode automatique: Anciens résultats nettoyés")
      }
    } catch (error) {
      console.error("Erreur nettoyage automatique:", error)
    }

    // Lancer le scraping
    console.log(`🤖 Mode automatique: Démarrage scraping (intervalle: ${interval}min)`)
    await startScraping()
  }

  useEffect(() => {
    if (autoMode && selectedSites.length > 0 && csvFile) {
      console.log(`🤖 Mode automatique ACTIVÉ - Intervalle: ${interval} minutes`)
      
      // Première exécution immédiate
      if (!currentJob || currentJob.status === "completed" || currentJob.status === "idle") {
        startAutomaticScraping()
      }

      const autoInterval = setInterval(
        () => {
          if (!currentJob || currentJob.status === "completed" || currentJob.status === "idle") {
            console.log(`🕒 Mode automatique: Déclenchement programmé après ${interval} minutes`)
            startAutomaticScraping()
          } else {
            console.log(`⏳ Mode automatique: Job en cours (${currentJob.status}), attente...`)
          }
        },
        interval * 60 * 1000,
      )

      return () => {
        console.log("🤖 Mode automatique DÉSACTIVÉ")
        clearInterval(autoInterval)
      }
    } else if (autoMode) {
      console.log("⚠️ Mode automatique: Configuration incomplète (sites ou CSV manquant)")
    }
  }, [autoMode, interval, selectedSites, csvFile, currentJob])

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-between items-center">
            <div></div>
            <div className="text-center">
              <h1 className="text-4xl font-bold text-slate-900">Job Scraper Dashboard</h1>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Automatisez la collecte d'offres d'emploi sur plusieurs plateformes avec un système de scraping intelligent
              </p>
            </div>
            <Button
              variant="outline"
              onClick={resetApplication}
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Réinitialiser
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Configuration Panel */}
          <div className="xl:col-span-3 space-y-8">
            {/* Site Selection */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="border-b border-slate-100 bg-white">
                <CardTitle className="flex items-center gap-3 text-xl text-slate-900">
                  <Target className="h-6 w-6 text-blue-600" />
                  Sélection des Plateformes
                </CardTitle>
                <CardDescription className="text-slate-600">
                  Choisissez les sites d'emploi à inclure dans votre recherche
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    className="border-slate-300 bg-transparent"
                  >
                    {selectedSites.length === SCRAPING_SITES.length ? "Désélectionner tout" : "Sélectionner tout"}
                  </Button>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                    {selectedSites.length}/{SCRAPING_SITES.length} sélectionnés
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {SCRAPING_SITES.map((site) => (
                    <div
                      key={site.id}
                      className={`group relative overflow-hidden rounded-lg border-2 transition-all duration-200 cursor-pointer ${
                        selectedSites.includes(site.id)
                          ? "border-blue-500 bg-blue-50 shadow-sm"
                          : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center space-x-4 p-4">
                        <Checkbox
                          id={site.id}
                          checked={selectedSites.includes(site.id)}
                          onCheckedChange={() => handleSiteToggle(site.id)}
                        />
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-3 h-3 rounded-full ${site.color}`} />
                          <Label htmlFor={site.id} className="cursor-pointer font-medium text-slate-900">
                            {site.name}
                          </Label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* File Upload */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="border-b border-slate-100 bg-white">
                <CardTitle className="flex items-center gap-3 text-xl text-slate-900">
                  <Upload className="h-6 w-6 text-green-600" />
                  Liste des Entreprises
                </CardTitle>
                <CardDescription className="text-slate-600">
                  Importez un fichier CSV contenant les entreprises à cibler
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    csvFile
                      ? "border-green-300 bg-green-50"
                      : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                  }`}
                >
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="csv-upload" />
                  <label htmlFor="csv-upload" className="cursor-pointer block">
                    <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-lg font-medium text-slate-900 mb-2">
                      {csvFile ? csvFile.name : "Sélectionner un fichier CSV"}
                    </p>
                    <p className="text-sm text-slate-600">
                      {csvFile ? "Fichier chargé avec succès" : "Glissez-déposez ou cliquez pour parcourir"}
                    </p>
                  </label>
                </div>

                {csvContent && (
                  <div className="space-y-4">
                    <Label className="text-sm font-medium text-slate-900">Aperçu du fichier :</Label>
                    <Textarea
                      value={csvContent.split("\n").slice(0, 5).join("\n")}
                      readOnly
                      className="h-32 text-sm bg-slate-50 border-slate-200"
                    />
                    <p className="text-sm text-slate-600 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      {csvContent.split("\n").length - 1} entreprises détectées
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Automation Settings */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="border-b border-slate-100 bg-white">
                <CardTitle className="flex items-center gap-3 text-xl text-slate-900">
                  <Settings className="h-6 w-6 text-purple-600" />
                  Configuration Automatique
                </CardTitle>
                <CardDescription className="text-slate-600">
                  Définissez les paramètres d'exécution automatique
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <Checkbox 
                    id="auto-mode" 
                    checked={autoMode} 
                    onCheckedChange={(checked) => setAutoMode(checked === true)} 
                  />
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-purple-600" />
                    <Label htmlFor="auto-mode" className="font-medium text-slate-900">
                      Mode automatique
                    </Label>
                  </div>
                  {autoMode && (
                    <div className="ml-auto flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
                        🤖 Actif
                    </Badge>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Label className="flex items-center gap-2 font-medium text-slate-900">
                    <Clock className="h-5 w-5 text-blue-600" />
                    Intervalle de répétition
                  </Label>
                  <Select value={(interval || 60).toString()} onValueChange={(value) => setIntervalMinutes(Number(value))}>
                    <SelectTrigger className="border-slate-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVAL_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Auto Mode Status */}
            {autoMode && (
              <Card className="shadow-sm border-green-200 bg-green-50">
                <CardHeader className="border-b border-green-200 bg-green-100">
                  <CardTitle className="flex items-center gap-3 text-lg text-green-900">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    Mode Automatique Actif
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-green-800">Intervalle:</span>
                      <p className="text-green-700">{interval} minutes</p>
                    </div>
                    <div>
                      <span className="font-medium text-green-800">Sites:</span>
                      <p className="text-green-700">{selectedSites.length} sélectionnés</p>
                    </div>
                    <div>
                      <span className="font-medium text-green-800">Entreprises:</span>
                      <p className="text-green-700">{csvContent ? csvContent.split("\n").length - 1 : 0} détectées</p>
                    </div>
                    <div>
                      <span className="font-medium text-green-800">Status:</span>
                      <p className="text-green-700">
                        {currentJob?.status === "running" ? "En cours..." : "En attente"}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-green-200">
                    <p className="text-xs text-green-600">
                      🕒 Le scraping se déclenchera automatiquement toutes les {interval} minutes
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Control Panel */}
          <div className="space-y-8">
            {/* Current Job Status */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="border-b border-slate-100 bg-white">
                <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                  <Activity className="h-5 w-5 text-blue-600" />
                  Statut du Scraping
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {currentJob ? (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700">Progression</span>
                        <Badge variant="outline" className="border-blue-300 text-blue-700">
                          {Math.round(currentJob.progress)}%
                        </Badge>
                      </div>
                      <Progress value={currentJob.progress} className="h-2" />
                    </div>

                    {currentJob.currentSite && (
                      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                        <div>
                          <p className="text-sm text-slate-600">Site en cours :</p>
                          <p className="font-medium text-slate-900">
                            {SCRAPING_SITES.find((s) => s.id === currentJob.currentSite)?.name ||
                              currentJob.currentSite}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {currentJob.status === "running" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={pauseScraping}
                          className="border-orange-300 bg-transparent"
                        >
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </Button>
                      )}
                      {currentJob.status === "paused" && (
                        <Button size="sm" onClick={resumeScraping} className="bg-green-600 hover:bg-green-700">
                          <Play className="h-4 w-4 mr-2" />
                          Reprendre
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={stopScraping}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Arrêter
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 space-y-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                      <Play className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="text-slate-600 font-medium">Prêt à démarrer</p>
                    <Button
                      onClick={startScraping}
                      disabled={selectedSites.length === 0 || !csvFile}
                      className="bg-blue-600 hover:bg-blue-700"
                      size="lg"
                    >
                      <Play className="h-5 w-5 mr-2" />
                      Démarrer le Scraping
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Results Download */}
            {currentJob?.results && (
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="border-b border-slate-100 bg-white">
                  <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Résultats
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="text-center space-y-2">
                      <div className="text-3xl font-bold text-green-600">{currentJob.results?.length || 0}</div>
                      <p className="text-sm text-slate-600">offres d'emploi collectées</p>
                      <p className="text-xs text-slate-500">{currentJob.sites?.length || 0} sites traités</p>
                    </div>
                    <Button
                      onClick={() => downloadResults(currentJob)}
                      className="w-full bg-green-600 hover:bg-green-700"
                      size="lg"
                    >
                      <Download className="h-5 w-5 mr-2" />
                      Télécharger JSON
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}


          </div>
        </div>
      </div>
    </div>
  )
}
