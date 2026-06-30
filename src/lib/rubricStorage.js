/**
 * IndexedDB Storage for Custom Rubrics
 * Provides simple helper functions to save, retrieve, and delete rubrics
 */

const DB_NAME = 'HomeworkHelperRubrics'
const DB_VERSION = 1
const STORE_NAME = 'rubrics'

let dbPromise = null

function getDB() {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        store.createIndex('name', 'name', { unique: false })
        store.createIndex('subject', 'subject', { unique: false })
        store.createIndex('gradeLevel', 'gradeLevel', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
  })

  return dbPromise
}

/**
 * Save a rubric to IndexedDB
 * @param {string} name - User-friendly name (e.g., "Chapter 4 Math Quiz")
 * @param {Object} rubricData - The rubric data array from OCR
 * @param {string} gradeLevel - Grade level (e.g., "5th")
 * @param {string} subject - Subject (e.g., "Math")
 * @returns {Promise<number>} The ID of the saved rubric
 */
export async function saveRubric(name, rubricData, gradeLevel, subject) {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.add({
      name,
      data: rubricData,
      gradeLevel,
      subject,
      createdAt: Date.now()
    })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get all saved rubrics from IndexedDB
 * @returns {Promise<Array>} Array of { id, name, data, gradeLevel, subject, createdAt }
 */
export async function getAllRubrics() {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Delete a rubric by ID
 * @param {number} id - The rubric ID
 * @returns {Promise<void>}
 */
export async function deleteRubric(id) {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get a single rubric by ID
 * @param {number} id - The rubric ID
 * @returns {Promise<Object|null>} The rubric or null if not found
 */
export async function getRubric(id) {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Update a rubric's name
 * @param {number} id - The rubric ID
 * @param {string} newName - New name
 * @returns {Promise<void>}
 */
export async function updateRubricName(id, newName) {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const getRequest = store.get(id)
    getRequest.onsuccess = () => {
      const rubric = getRequest.result
      if (!rubric) {
        reject(new Error('Rubric not found'))
        return
      }
      rubric.name = newName
      const putRequest = store.put(rubric)
      putRequest.onsuccess = () => resolve()
      putRequest.onerror = () => reject(putRequest.error)
    }
    getRequest.onerror = () => reject(getRequest.error)
  })
}