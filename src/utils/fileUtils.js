import { supabase } from '../supabase'

// Upload un fichier dans Supabase Storage
export async function uploadFile(file, bucket, folder = '') {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = folder ? `${folder}/${fileName}` : fileName

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) throw error

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)

    return { path: filePath, url: publicUrl, error: null }
  } catch (error) {
    return { path: null, url: null, error: error.message }
  }
}

// Parser un CV avec la fonction serverless Vercel
export async function parseCV(file) {
  try {
    // Convertir le fichier en base64
    const reader = new FileReader()
    const fileData = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    // Appeler la fonction serverless Vercel (pas directement l'API Claude)
    const response = await fetch('/api/parse-cv', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileData: fileData.split(',')[1],
        fileType: file.type
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const result = await response.json()
    return { data: result.data, error: null }
  } catch (error) {
    console.error('Erreur parsing CV:', error)
    return { data: null, error: error.message }
  }
}