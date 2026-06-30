// Application Logic - Smart Lead Importer from Scrap


// State variables
let processedLeads = [];
let savedLeadsCount = 0;
let duplicatesCount = 0;
let errorsCount = 0;

// Default Mock Examples for testing
const MOCK_EXAMPLES = `Juan Pérez - 51999999999 - quiere automatizar WhatsApp
María Gómez / maria@email.com / negocio de estética
Empresa: Panadería Los Andes, Tel: +51987654321
Carlos Soto - csoto@gmail.com - Cel: 912345678 - desea bot de ventas
Sofía Castro, WhatsApp de marketing, Tel: 987654
Juan Pérez - 51999999999 - quiere automatizar WhatsApp
Falta Información, email: incompleto@c.c
Empresa: Estética Bella / info@esteticabella.com / WhatsApp CRM`;

// Local Database Simulator (stored in localStorage)
const STORAGE_KEYS = {
    LEADS: 'smart_importer_saved_leads',
    SETTINGS: 'smart_importer_settings'
};

// Initial Config
let appConfig = {
    integrationType: 'local', // 'local', 'supabase', 'webhook'
    supabaseUrl: '',
    supabaseKey: '',
    supabaseTable: 'leads',
    webhookUrl: ''
};

// DOM Elements
const themeToggle = document.getElementById('theme-toggle');
const scrapTextarea = document.getElementById('scrap-textarea');
const loadExampleBtn = document.getElementById('load-example-btn');
const processBtn = document.getElementById('process-btn');
const sourceCards = document.querySelectorAll('.source-card');
const statsPanel = document.getElementById('stats-panel');
const tableContainer = document.getElementById('table-container');
const emptyState = document.getElementById('empty-state');
const resultsSummary = document.getElementById('results-summary');
const selectAllLeads = document.getElementById('select-all-leads');
const leadsTableBody = document.getElementById('leads-table-body');
const saveSelectedBtn = document.getElementById('save-selected-btn');
const resetFormBtn = document.getElementById('reset-form-btn');
const btnExportCsv = document.getElementById('btn-export-csv');
const btnExportJson = document.getElementById('btn-export-json');

// Stats Counters
const statTotal = document.getElementById('stat-total');
const statReady = document.getElementById('stat-ready');
const statDuplicates = document.getElementById('stat-duplicates');
const statErrors = document.getElementById('stat-errors');

// Settings Modal
const settingsModal = document.getElementById('settings-modal');
const openSettingsBtn = document.getElementById('open-settings-btn');
const closeModalBtns = document.querySelectorAll('.close-modal-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const activeIntegrationLabel = document.getElementById('active-integration-label');
const integrationBadgeType = document.getElementById('integration-badge-type');

// Modal inputs
const supabaseUrlInput = document.getElementById('supabase-url');
const supabaseKeyInput = document.getElementById('supabase-key');
const supabaseTableInput = document.getElementById('supabase-table');
const webhookUrlInput = document.getElementById('webhook-url');

// Selected source tracker
let selectedSource = 'Facebook Ads';

// Initialize App
window.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    initTheme();
    setupEventListeners();
    updateSelectedCount();
    lucide.createIcons();
});

// Theme Initialization (Default to Dark Theme)
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
    }
}

// Toggle Theme
themeToggle.addEventListener('click', () => {
    if (document.body.classList.contains('dark-theme')) {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
    } else {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
    }
});

// Setup Event Listeners
function setupEventListeners() {
    // Load example
    loadExampleBtn.addEventListener('click', () => {
        scrapTextarea.value = MOCK_EXAMPLES;
        showToast('Texto de ejemplo cargado', 'info');
    });

    // Process button
    processBtn.addEventListener('click', processScrapData);

    // Source Selector
    sourceCards.forEach(card => {
        card.addEventListener('click', () => {
            sourceCards.forEach(c => {
                c.classList.remove('active');
                c.setAttribute('aria-checked', 'false');
            });
            card.classList.add('active');
            card.setAttribute('aria-checked', 'true');
            selectedSource = card.getAttribute('data-source');
        });
        
        // Accessibility Enter/Space select
        card.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                card.click();
            }
        });
    });

    // Select All Checkbox
    selectAllLeads.addEventListener('change', (e) => {
        const checked = e.target.checked;
        const checkboxes = leadsTableBody.querySelectorAll('.lead-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = checked;
            const row = cb.closest('tr');
            if (checked) {
                row.classList.remove('row-excluded');
            } else {
                row.classList.add('row-excluded');
            }
            // Update model state
            const index = parseInt(cb.getAttribute('data-index'));
            if (processedLeads[index]) {
                processedLeads[index].selected = checked;
            }
        });
        updateSelectedCount();
    });

    // Save Selected
    saveSelectedBtn.addEventListener('click', saveSelectedLeads);

    // Reset Form
    resetFormBtn.addEventListener('click', resetImporter);

    // Export buttons
    btnExportCsv.addEventListener('click', exportCSV);
    btnExportJson.addEventListener('click', exportJSON);

    // Modal Events
    openSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hide');
    });

    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            settingsModal.classList.add('hide');
        });
    });

    // Modal Tab Selector
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hide'));

            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.remove('hide');
        });
    });

    // Save Settings
    saveSettingsBtn.addEventListener('click', saveSettings);
}

// Load configurations from Local Storage
function loadSettings() {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (saved) {
        try {
            appConfig = JSON.parse(saved);
            
            // Populate inputs
            supabaseUrlInput.value = appConfig.supabaseUrl || '';
            supabaseKeyInput.value = appConfig.supabaseKey || '';
            supabaseTableInput.value = appConfig.supabaseTable || 'leads';
            webhookUrlInput.value = appConfig.webhookUrl || '';
            
            // Update active tab button in UI
            tabButtons.forEach(btn => {
                const type = btn.getAttribute('data-tab').replace('tab-', '');
                if (type === appConfig.integrationType) {
                    btn.click();
                }
            });
        } catch (e) {
            console.error('Error loading config', e);
        }
    }
    updateIntegrationUI();
}

// Save config settings
function saveSettings() {
    const activeTab = document.querySelector('.tab-btn.active');
    const type = activeTab.getAttribute('data-tab').replace('tab-', '');
    
    appConfig.integrationType = type;
    appConfig.supabaseUrl = supabaseUrlInput.value.trim();
    appConfig.supabaseKey = supabaseKeyInput.value.trim();
    appConfig.supabaseTable = supabaseTableInput.value.trim() || 'leads';
    appConfig.webhookUrl = webhookUrlInput.value.trim();
    
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(appConfig));
    updateIntegrationUI();
    settingsModal.classList.add('hide');
    showToast('Configuración guardada correctamente', 'success');
}

// Update integration info labels
function updateIntegrationUI() {
    if (appConfig.integrationType === 'supabase') {
        activeIntegrationLabel.textContent = `Supabase (${appConfig.supabaseTable})`;
        integrationBadgeType.textContent = 'Supabase Cloud';
        integrationBadgeType.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
        integrationBadgeType.style.color = '#10b981';
    } else if (appConfig.integrationType === 'webhook') {
        const urlObj = appConfig.webhookUrl ? new URL(appConfig.webhookUrl) : null;
        activeIntegrationLabel.textContent = urlObj ? `Webhook: ${urlObj.hostname}` : 'Webhook no configurado';
        integrationBadgeType.textContent = 'REST Endpoint';
        integrationBadgeType.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
        integrationBadgeType.style.color = '#6366f1';
    } else {
        activeIntegrationLabel.textContent = 'Simulado (Memoria Local)';
        integrationBadgeType.textContent = 'Local Storage';
        integrationBadgeType.style.backgroundColor = '';
        integrationBadgeType.style.color = '';
    }
}

// Clean and parse phone numbers, checking specifically for Peruvian formats (+51..., 9...)
function extractPhone(text) {
    // Normalize string: keep digits, + sign
    const cleaned = text.replace(/[^0-9+]/g, '');
    
    // Look for patterns
    // 1. Peruvian format (+51 9xx xxx xxx or 51 9xx xxx xxx)
    const peruvianMatch = cleaned.match(/(\+?51)?(9\d{8})\b/);
    if (peruvianMatch) {
        return `+51 ${peruvianMatch[2]}`;
    }
    
    // 2. Simple 9-digit starting with 9
    const simpleMatch = cleaned.match(/\b(9\d{8})\b/);
    if (simpleMatch) {
        return `+51 ${simpleMatch[1]}`;
    }

    // 3. General numbers with 7 to 15 digits
    const generalMatch = cleaned.match(/\+?\d{7,15}/);
    if (generalMatch) {
        return generalMatch[0];
    }
    
    return '';
}

// Extract email pattern
function extractEmail(text) {
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
    const match = text.match(emailRegex);
    return match ? match[1] : '';
}

// Intelligent Parser Heuristic
function parseLine(line, index) {
    const trimmedLine = line.trim();
    if (!trimmedLine) return null;

    let lead = {
        id: 'lead_' + Date.now() + '_' + index,
        originalMessage: trimmedLine,
        source: selectedSource,
        date: new Date().toISOString().split('T')[0],
        name: '',
        phone: '',
        email: '',
        company: '',
        businessType: '',
        service: '',
        status: 'Listo',
        observation: '',
        selected: true
    };

    // Extract basic fields via regex
    lead.email = extractEmail(trimmedLine);
    lead.phone = extractPhone(trimmedLine);

    // Parsing Strategy: Split line by common separators
    // e.g. - , / |
    const parts = trimmedLine.split(/\s*[-/|]\s*|\s*,\s*/);
    
    // Check if line contains label-value tags (e.g. "Empresa: Panaderia", "Cel: +51...")
    const labelPatterns = {
        company: /(?:empresa|negocio|compañía|salon|estética):\s*([^,-/|]+)/i,
        name: /(?:nombre|contacto|cliente):\s*([^,-/|]+)/i,
        phone: /(?:tel|cel|celular|teléfono|whatsapp):\s*([^,-/|]+)/i,
        email: /(?:email|correo|mail):\s*([^,-/|]+)/i,
        service: /(?:interés|servicio|quiere|desea|pide):\s*([^,-/|]+)/i
    };

    let hasLabels = false;
    for (const [key, regex] of Object.entries(labelPatterns)) {
        const match = trimmedLine.match(regex);
        if (match) {
            hasLabels = true;
            const val = match[1].trim();
            if (key === 'company') lead.company = val;
            if (key === 'name') lead.name = val;
            if (key === 'service') lead.service = val;
            // Phone and email are already parsed by regex, but we can override if explicitly labeled
        }
    }

    if (!hasLabels && parts.length > 0) {
        // Try heuristic assignment based on positions and characteristics of parts
        let remainingParts = [...parts];

        // 1. Filter out already detected email part
        if (lead.email) {
            remainingParts = remainingParts.filter(p => !p.includes(lead.email));
        }

        // 2. Filter out parts that contain phone numbers
        if (lead.phone) {
            const rawPhone = lead.phone.replace(/[^0-9]/g, '');
            remainingParts = remainingParts.filter(p => {
                const cleanedPart = p.replace(/[^0-9]/g, '');
                return !cleanedPart.includes(rawPhone) && cleanedPart.length < 6;
            });
        }

        // 3. First remaining part is likely the Name if it contains letters and is 2-4 words
        if (remainingParts.length > 0) {
            const potentialName = remainingParts[0].trim();
            // Verify it doesn't look like an observation or random keywords
            if (potentialName.split(/\s+/).length <= 4 && !/quiere|desea|bot|whatsapp|web|automatizar|comprar|ads/i.test(potentialName)) {
                lead.name = potentialName;
                remainingParts.shift(); // remove assigned part
            }
        }

        // 4. Look for business tags or company references
        remainingParts.forEach((part, pIdx) => {
            const pText = part.trim();
            if (/negocio de|empresa|panadería|estética|tienda|comercio|restaurante/i.test(pText)) {
                lead.company = pText.replace(/negocio de|empresa:\s*|empresa\s*/i, '').trim();
                lead.businessType = pText.match(/estética|panadería|tienda|restaurante/i)?.[0] || 'Negocio';
            } else if (/whatsapp|bot|web|crm|automatizar|marketing|campaña/i.test(pText)) {
                lead.service = pText.trim();
            } else if (pText && !lead.name && pIdx === 0) {
                // Failback name
                lead.name = pText;
            } else if (pText && !lead.observation) {
                lead.observation = pText;
            }
        });
    }

    // Secondary heuristic checks for companies and services
    if (!lead.company && /panadería/i.test(trimmedLine)) {
        lead.company = 'Panadería';
        lead.businessType = 'Panadería';
    }
    if (!lead.company && /estética/i.test(trimmedLine)) {
        lead.company = 'Estética';
        lead.businessType = 'Estética';
    }
    if (/whatsapp|bot/i.test(trimmedLine)) {
        lead.service = lead.service || 'WhatsApp Bot / IA';
    } else if (/web/i.test(trimmedLine)) {
        lead.service = lead.service || 'Diseño Web';
    }

    // Clean up names
    if (lead.name) {
        // Strip out noise words
        lead.name = lead.name.replace(/^(empresa|contacto|nombre|cliente):\s*/i, '').trim();
        // Capitalize words
        lead.name = lead.name.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }

    return lead;
}

// Chunking logic to split large text into smaller parts
function chunkTextByLines(text, maxChars) {
    const lines = text.split('\n');
    const chunks = [];
    let currentChunk = '';

    for (const line of lines) {
        if (currentChunk.length + line.length > maxChars && currentChunk.length > 0) {
            chunks.push(currentChunk);
            currentChunk = line;
        } else {
            currentChunk += (currentChunk ? '\n' : '') + line;
        }
    }
    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk);
    }
    return chunks;
}

// Process scrap input using Backend API
async function processScrapData() {
    const rawText = scrapTextarea.value.trim();
    if (!rawText) {
        showToast('Por favor, pega algún texto para procesar.', 'warning');
        return;
    }

    // Get selected source
    const activeSourceCard = document.querySelector('.source-card.active');
    const source = activeSourceCard ? activeSourceCard.getAttribute('data-source') : 'Otro';

    // UI Loading state
    processBtn.disabled = true;
    processBtn.querySelector('.icon-play').classList.add('hide');
    processBtn.querySelector('.icon-loader').classList.remove('hide');

    try {
        const chunks = chunkTextByLines(rawText, 3500);
        let allLeads = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            processBtn.querySelector('.btn-text').textContent = `Procesando lote ${i + 1} de ${chunks.length}...`;
            
            if (chunks.length > 1) {
                showToast(`Procesando lote ${i + 1} de ${chunks.length}...`, 'info');
            }

            const response = await fetch('http://localhost:4000/api/process-scrap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rawText: chunk, source })
            });

            if (!response.ok) {
                let errorMsg = `Error HTTP: ${response.status}`;
                try {
                    const errorObj = await response.json();
                    if (errorObj.error) errorMsg = errorObj.error;
                } catch(e) {}
                throw new Error(errorMsg);
            }

            const data = await response.json();
            allLeads = allLeads.concat(data);
        }
        
        // Update local state
        processedLeads = allLeads;

        // Update UI
        renderStats();
        renderLeadsTable();

        emptyState.classList.add('hide');
        resultsSummary.classList.add('hide');
        tableContainer.classList.remove('hide');

        const loteStr = chunks.length > 1 ? ` en ${chunks.length} lotes` : '';
        showToast(`Se procesaron ${processedLeads.length} leads con IA${loteStr}`, 'success');
    } catch (error) {
        console.error("Error al procesar el scrap:", error);
        showToast(error.message || 'Ocurrió un error al procesar los datos. Verifica que el backend esté corriendo.', 'danger');
    } finally {
        // Reset button
        processBtn.disabled = false;
        processBtn.querySelector('.btn-text').textContent = 'Procesar datos';
        processBtn.querySelector('.icon-play').classList.remove('hide');
        processBtn.querySelector('.icon-loader').classList.add('hide');
    }
}

// Calculate and render stats in real-time
function renderStats() {
    const total = processedLeads.length;
    const ready = processedLeads.filter(l => l.status === 'Listo').length;
    const duplicates = processedLeads.filter(l => l.status === 'Duplicado').length;
    const errors = processedLeads.filter(l => l.status !== 'Listo' && l.status !== 'Duplicado').length;

    statTotal.textContent = total;
    statReady.textContent = ready;
    statDuplicates.textContent = duplicates;
    statErrors.textContent = errors;
}

// Render the preview table
function renderLeadsTable() {
    leadsTableBody.innerHTML = '';
    
    if (processedLeads.length === 0) {
        tableContainer.classList.add('hide');
        emptyState.classList.remove('hide');
        return;
    }

    // Set select-all checked value based on leads selection
    const allSelected = processedLeads.every(l => l.selected);
    selectAllLeads.checked = allSelected;

    processedLeads.forEach((lead, idx) => {
        const tr = document.createElement('tr');
        if (!lead.selected) {
            tr.classList.add('row-excluded');
        }

        // Determine status tag style
        let statusClass = 'ready';
        if (lead.status === 'Duplicado') statusClass = 'duplicate';
        else if (lead.status === 'Falta teléfono') statusClass = 'missing-phone';
        else if (lead.status === 'Falta email') statusClass = 'missing-email';
        else if (lead.status === 'Datos incompletos') statusClass = 'incomplete';
        else if (lead.status === 'Formato inválido') statusClass = 'invalid';

        tr.innerHTML = `
            <td class="col-checkbox">
                <label class="checkbox-container">
                    <input type="checkbox" class="lead-checkbox" data-index="${idx}" ${lead.selected ? 'checked' : ''}>
                    <span class="checkmark"></span>
                </label>
            </td>
            <td class="leads-theme-edit" contenteditable="true" data-index="${idx}" data-field="nombre_negocio" title="Doble clic para editar">${lead.nombre_negocio || ''}</td>
            <td class="leads-theme-edit" contenteditable="true" data-index="${idx}" data-field="categoria" title="Doble clic para editar">${lead.categoria || ''}</td>
            <td class="leads-theme-edit" contenteditable="true" data-index="${idx}" data-field="telefono" title="Doble clic para editar">${lead.telefono || ''}</td>
            <td class="leads-theme-edit" contenteditable="true" data-index="${idx}" data-field="direccion" title="Doble clic para editar">${lead.direccion || ''}</td>
            <td class="leads-theme-edit" contenteditable="true" data-index="${idx}" data-field="estado" title="Doble clic para editar">${lead.estado || ''}</td>
            <td class="leads-theme-edit" contenteditable="true" data-index="${idx}" data-field="estado_web" title="Doble clic para editar">${lead.estado_web || ''}</td>
            <td class="leads-theme-edit" contenteditable="true" data-index="${idx}" data-field="motivo_estado_web" title="Doble clic para editar">${lead.motivo_estado_web || ''}</td>
            <td class="leads-theme-edit" contenteditable="true" data-index="${idx}" data-field="whatsapp_web" title="Doble clic para editar">${lead.whatsapp_web || ''}</td>
            <td class="leads-theme-edit" contenteditable="true" data-index="${idx}" data-field="tiene_instagram" title="Doble clic para editar">${lead.tiene_instagram || ''}</td>
            <td class="leads-theme-edit" contenteditable="true" data-index="${idx}" data-field="cantidad_fotos" title="Doble clic para editar">${lead.cantidad_fotos || ''}</td>
            <td class="leads-theme-edit" contenteditable="true" data-index="${idx}" data-field="actividad_reciente" title="Doble clic para editar">${lead.actividad_reciente || ''}</td>
            <td class="leads-theme-edit" contenteditable="true" data-index="${idx}" data-field="rating" title="Doble clic para editar">${lead.rating || ''}</td>
            <td class="leads-theme-edit" contenteditable="true" data-index="${idx}" data-field="reviews" title="Doble clic para editar">${lead.reviews || ''}</td>
            <td class="leads-theme-edit" contenteditable="true" data-index="${idx}" data-field="score" title="Doble clic para editar">${lead.score || ''}</td>
            <td class="leads-theme-edit" contenteditable="true" data-index="${idx}" data-field="prioridad" title="Doble clic para editar">${lead.prioridad || ''}</td>
            <td class="leads-theme-edit" contenteditable="true" data-index="${idx}" data-field="analisis_ia" title="Doble clic para editar">${lead.analisis_ia || ''}</td>
            <td class="leads-theme-edit" contenteditable="true" data-index="${idx}" data-field="mensaje" title="Doble clic para editar">${lead.mensaje || ''}</td>
            <td class="leads-theme-edit" contenteditable="true" data-index="${idx}" data-field="sitio_web" title="Doble clic para editar">${lead.sitio_web || ''}</td>
            <td class="col-actions">
                <button class="row-btn-delete" data-index="${idx}" title="Eliminar fila">
                    <i data-lucide="trash-2"></i>
                </button>
            </td>
        `;

        leadsTableBody.appendChild(tr);
    });

    // Add events for table inputs editing
    setupTableCellListeners();
    updateSelectedCount();
    lucide.createIcons();
}

// Table inline editable listener
function setupTableCellListeners() {
    // Checkbox changed
    const checkboxes = leadsTableBody.querySelectorAll('.lead-checkbox');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            const checked = e.target.checked;
            processedLeads[index].selected = checked;
            
            const row = e.target.closest('tr');
            if (checked) {
                row.classList.remove('row-excluded');
            } else {
                row.classList.add('row-excluded');
            }
            updateSelectedCount();
            
            // Check if all are selected
            const allSelected = processedLeads.every(l => l.selected);
            selectAllLeads.checked = allSelected;
        });
    });

    // Edit contenteditable fields
    const editableCells = leadsTableBody.querySelectorAll('.leads-theme-edit');
    editableCells.forEach(cell => {
        cell.addEventListener('blur', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            const field = e.target.getAttribute('data-field');
            const newValue = e.target.textContent.trim();
            
            if (processedLeads[index]) {
                processedLeads[index][field] = newValue;
                
                // If phone/email changed, re-validate this specific row
                if (field === 'phone' || field === 'email' || field === 'name') {
                    validateSingleLead(index);
                    renderStats();
                    // Re-render table slightly to adjust status color labels without losing cursor focus
                    // Instead of full render, we can just update status badge cell
                    const statusTd = e.target.closest('tr').querySelector('.status-badge');
                    const obsTd = e.target.closest('tr').querySelector('[data-field="observation"]');
                    
                    let statusClass = 'ready';
                    if (processedLeads[index].status === 'Duplicado') statusClass = 'duplicate';
                    else if (processedLeads[index].status === 'Falta teléfono') statusClass = 'missing-phone';
                    else if (processedLeads[index].status === 'Falta email') statusClass = 'missing-email';
                    else if (processedLeads[index].status === 'Datos incompletos') statusClass = 'incomplete';
                    else if (processedLeads[index].status === 'Formato inválido') statusClass = 'invalid';
                    
                    statusTd.className = `status-badge ${statusClass}`;
                    statusTd.textContent = processedLeads[index].status;
                    obsTd.textContent = processedLeads[index].observation || '-';
                }
            }
        });

        // Keypress Enter saves blur
        cell.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                cell.blur();
            }
        });
    });

    // Delete row
    const deleteBtns = leadsTableBody.querySelectorAll('.row-btn-delete');
    deleteBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(btn.getAttribute('data-index'));
            processedLeads.splice(index, 1);
            renderStats();
            renderLeadsTable();
            showToast('Prospecto removido de la vista previa', 'info');
        });
    });
}

// Re-evaluate validation for single lead
function validateSingleLead(index) {
    const parsed = processedLeads[index];
    if (!parsed) return;

    if (!parsed.name) {
        parsed.status = 'Datos incompletos';
        parsed.observation = 'Falta el nombre del contacto.';
    } else if (!parsed.phone && !parsed.email) {
        parsed.status = 'Datos incompletos';
        parsed.observation = 'No se detectó teléfono ni correo electrónico.';
    } else if (!parsed.phone) {
        parsed.status = 'Falta teléfono';
        parsed.observation = 'Teléfono no detectado.';
    } else if (!parsed.email) {
        parsed.status = 'Falta email';
        parsed.observation = 'Correo electrónico no detectado.';
    } else if (parsed.phone && parsed.phone.replace(/[^0-9]/g, '').length < 7) {
        parsed.status = 'Formato inválido';
        parsed.observation = 'El teléfono es demasiado corto o inválido.';
    } else {
        parsed.status = 'Listo';
        parsed.observation = '';
    }
}

// Update selected count display label
function updateSelectedCount() {
    const selected = processedLeads.filter(l => l.selected).length;
    const selectedCountLabel = document.getElementById('selected-count-label');
    if (selectedCountLabel) {
        selectedCountLabel.textContent = `${selected} prospectos seleccionados para guardar`;
    }
    saveSelectedBtn.disabled = selected === 0;
}

// Save selected leads to Google Sheets Webhook
async function saveSelectedLeads() {
    const leadsToSave = processedLeads.filter(l => l.selected);
    if (leadsToSave.length === 0) {
        showToast('No hay prospectos seleccionados para guardar.', 'warning');
        return;
    }

    // Get selected source
    const activeSourceCard = document.querySelector('.source-card.active');
    const source = activeSourceCard ? activeSourceCard.getAttribute('data-source') : 'Otro';

    // Button loading animation
    saveSelectedBtn.disabled = true;
    saveSelectedBtn.querySelector('.btn-text').textContent = 'Guardando en Google Sheets...';
    saveSelectedBtn.querySelector('.icon-save').classList.add('hide');
    saveSelectedBtn.querySelector('.icon-loader').classList.remove('hide');

    let savedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    try {
        const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzLghbWOdMCtge-OvTGRoVqluQmwsjGYFXZBjMpyIGxW_Ns7QIs3uYFVDSkdUOqJD1N/exec';
        
        // Agregar columnas base del CRM a cada lead antes de enviar
        const leadsCRM = leadsToSave.map(lead => ({
            ...lead,
            id_lead: crypto.randomUUID ? crypto.randomUUID() : 'id_' + new Date().getTime() + Math.random().toString(16).slice(2),
            fecha_importacion: new Date().toISOString(),
            fecha_ultimo_contacto: '',
            fecha_proximo_seguimiento: '',
            estado_comercial: 'nuevo',
            responsable: '',
            notas: '',
            respuesta_cliente: '',
            fecha_cierre: '',
            valor_estimado: '',
            origen_scraping: source
        }));

        // Usamos el servidor Node.js como proxy para evitar problemas de CORS
        // y poder leer respuestas (como cantidad de duplicados en el futuro)
        const response = await fetch('http://localhost:4000/api/sheets/post', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                webhookUrl: WEBHOOK_URL,
                payload: {
                    source: source,
                    timestamp: new Date().toISOString(),
                    leads: leadsCRM 
                }
            })
        });

        // Some webhooks return ok even on 302 redirects (Apps Script default behavior)
        if (!response.ok && response.type !== 'opaque') {
            throw new Error('Error al conectar con Google Sheets');
        }

        // Leer la respuesta de nuestro proxy Node.js
        const resultData = await response.json();
        
        if (resultData && resultData.stats) {
            savedCount = resultData.stats.nuevos || 0;
            duplicateCount = resultData.stats.duplicadosEvitados || 0;
        } else {
            savedCount = leadsToSave.length;
        }

        // Capture batch sizes
        errorsCount = processedLeads.filter(l => l.status !== 'Listo' && l.status !== 'Duplicado').length;

        // Render success summary
        document.getElementById('res-processed').textContent = processedLeads.length;
        document.getElementById('res-saved').textContent = savedCount;
        document.getElementById('res-duplicates').textContent = duplicateCount;
        document.getElementById('res-errors').textContent = errorsCount;
        
        // Date timestamp
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = now.toLocaleDateString();
        document.getElementById('results-timestamp').textContent = `Registrado el ${dateStr} a las ${timeStr}`;

        // Reset loading btn on success
        saveSelectedBtn.disabled = false;
        saveSelectedBtn.querySelector('.btn-text').textContent = 'Guardar leads seleccionados';
        saveSelectedBtn.querySelector('.icon-save').classList.remove('hide');
        saveSelectedBtn.querySelector('.icon-loader').classList.add('hide');

        // Switch cards views
        tableContainer.classList.add('hide');
        resultsSummary.classList.remove('hide');
        
        showToast(`¡Éxito! ${savedCount} leads guardados en Google Sheets.`, 'success');

    } catch (err) {
        console.error('Save failed', err);
        showToast(`Fallo al guardar: ${err.message || 'Error de conexión'}`, 'error');
        
        // Reset loading btn on failure
        saveSelectedBtn.disabled = false;
        saveSelectedBtn.querySelector('.btn-text').textContent = 'Guardar leads seleccionados';
        saveSelectedBtn.querySelector('.icon-save').classList.remove('hide');
        saveSelectedBtn.querySelector('.icon-loader').classList.add('hide');
    }
}

// Reset view states back to empty scrap
function resetImporter() {
    processedLeads = [];
    scrapTextarea.value = '';
    
    // Switch views
    tableContainer.classList.add('hide');
    resultsSummary.classList.add('hide');
    emptyState.classList.remove('hide');
    
    // Reset counters
    statTotal.textContent = '0';
    statReady.textContent = '0';
    statDuplicates.textContent = '0';
    statErrors.textContent = '0';
    
    showToast('Limpieza de importador completada', 'info');
}

// Export parsed table data to CSV
function exportCSV() {
    if (processedLeads.length === 0) return;
    
    const headers = [
        'Nombre Negocio', 'Categoría', 'Teléfono', 'Dirección', 'Estado',
        'Estado Web', 'Motivo Web', 'WhatsApp Web', 'Tiene Instagram', 'Cant. Fotos',
        'Actividad Reciente', 'Rating', 'Reviews', 'Score', 'Prioridad',
        'Análisis IA', 'Mensaje', 'Sitio Web', 'Fecha'
    ];
    
    const rows = processedLeads.map(l => [
        `"${(l.nombre_negocio || '').replace(/"/g, '""')}"`,
        `"${(l.categoria || '').replace(/"/g, '""')}"`,
        `"${(l.telefono || '').replace(/"/g, '""')}"`,
        `"${(l.direccion || '').replace(/"/g, '""')}"`,
        `"${(l.estado || '').replace(/"/g, '""')}"`,
        `"${(l.estado_web || '').replace(/"/g, '""')}"`,
        `"${(l.motivo_estado_web || '').replace(/"/g, '""')}"`,
        `"${(l.whatsapp_web || '').replace(/"/g, '""')}"`,
        `"${(l.tiene_instagram || '').replace(/"/g, '""')}"`,
        `"${(l.cantidad_fotos || '').replace(/"/g, '""')}"`,
        `"${(l.actividad_reciente || '').replace(/"/g, '""')}"`,
        `"${(l.rating || '').replace(/"/g, '""')}"`,
        `"${(l.reviews || '').replace(/"/g, '""')}"`,
        `"${(l.score || '').replace(/"/g, '""')}"`,
        `"${(l.prioridad || '').replace(/"/g, '""')}"`,
        `"${(l.analisis_ia || '').replace(/"/g, '""')}"`,
        `"${(l.mensaje || '').replace(/"/g, '""')}"`,
        `"${(l.sitio_web || '').replace(/"/g, '""')}"`,
        `"${(l.date || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
        + headers.join(',') + '\n'
        + rows.map(r => r.join(',')).join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `leads_scrap_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Archivo CSV descargado', 'success');
}

// Export parsed data to JSON
function exportJSON() {
    if (processedLeads.length === 0) return;
    
    const jsonString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(processedLeads, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", jsonString);
    link.setAttribute("download", `leads_scrap_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Archivo JSON descargado', 'success');
}

// Custom Toast notification system
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    else if (type === 'warning') iconName = 'alert-triangle';
    else if (type === 'error') iconName = 'alert-circle';
    
    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <div class="toast-content">${message}</div>
    `;
    
    container.appendChild(toast);
    lucide.createIcons();
    
    // Remove toast after duration
    setTimeout(() => {
        toast.style.animation = 'toast-in 0.3s ease reverse forwards';
        setTimeout(() => {
            if(container.contains(toast)) container.removeChild(toast);
        }, 300);
    }, 4000);
}

// ==========================================
// CRM MODULE LOGIC (FASE 3)
// ==========================================
let crmData = [];
let crmCurrentPage = 1;
const CRM_PAGE_SIZE = 20;
let crmActiveFilter = 'todos';
let crmSearchQuery = '';

// Tab Navigation Logic
document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        // Remove active class from all tabs
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Hide all views
        document.querySelectorAll('.view-section').forEach(v => v.classList.add('hide'));
        
        // Show target view
        const targetId = tab.getAttribute('data-view');
        document.getElementById(targetId).classList.remove('hide');

        // If CRM tab selected, load data
        if(targetId === 'view-crm') {
            fetchCrmData();
        }
    });
});

// Fetch CRM Data
async function fetchCrmData() {
    const tbody = document.getElementById('crm-table-body');
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 30px;"><i data-lucide="loader-2" class="spin"></i> Cargando leads desde Google Sheets...</td></tr>';
    document.getElementById('crm-pagination').innerHTML = '';
    lucide.createIcons();

    try {
        const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzLghbWOdMCtge-OvTGRoVqluQmwsjGYFXZBjMpyIGxW_Ns7QIs3uYFVDSkdUOqJD1N/exec';
        
        const response = await fetch('http://localhost:4000/api/sheets/get', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ webhookUrl: WEBHOOK_URL })
        });

        if(!response.ok) throw new Error('Error de red');
        const data = await response.json();
        
        crmData = data.data || [];
        crmCurrentPage = 1;
        applyFiltersAndRender();
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 30px; color: var(--error-color);">Error cargando los datos. Revisa la consola.</td></tr>';
    }
}

// Apply active filter + search query, then render
function applyFiltersAndRender() {
    let filtered = [...crmData];

    // 1. Filter by status
    if (crmActiveFilter !== 'todos') {
        filtered = filtered.filter(l => (l.estado_comercial || '').toLowerCase() === crmActiveFilter.toLowerCase());
    }

    // 2. Filter by phone or business name search
    if (crmSearchQuery.trim() !== '') {
        const queryRaw = crmSearchQuery.trim().toLowerCase();
        const queryNoSpaces = queryRaw.replace(/\s+/g, '');
        filtered = filtered.filter(l => {
            const phone = (l.telefono || '').replace(/\s+/g, '');
            const name = (l.nombre_negocio || '').toLowerCase();
            return phone.includes(queryNoSpaces) || name.includes(queryRaw);
        });
    }

    renderCrmTable(filtered);
}

function renderCrmTable(dataToRender) {
    const tbody = document.getElementById('crm-table-body');
    const totalCountSpan = document.getElementById('crm-total-count');
    
    if(totalCountSpan) {
        totalCountSpan.textContent = crmData.length;
    }

    tbody.innerHTML = '';

    if(dataToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 30px;">No hay leads con esos criterios.</td></tr>';
        document.getElementById('crm-pagination').innerHTML = '';
        return;
    }

    // Pagination slice
    const totalPages = Math.ceil(dataToRender.length / CRM_PAGE_SIZE);
    if (crmCurrentPage > totalPages) crmCurrentPage = totalPages;
    const start = (crmCurrentPage - 1) * CRM_PAGE_SIZE;
    const end = start + CRM_PAGE_SIZE;
    const pageData = dataToRender.slice(start, end);

    pageData.forEach((lead, localIndex) => {
        const tr = document.createElement('tr');
        const globalIndex = crmData.indexOf(lead);
        
        let priorityClass = '';
        if(lead.prioridad === 'Alta') priorityClass = 'text-success';
        if(lead.prioridad === 'Baja') priorityClass = 'text-error';

        // Clean up display phone
        let displayPhone = lead.telefono || '';
        if (!displayPhone || displayPhone.includes('ERROR') || displayPhone.trim() === '-' || displayPhone.trim() === 'Sin teléfono') {
            displayPhone = '-';
        }

        // Status badge color
        const estadoVal = (lead.estado_comercial || 'nuevo').toLowerCase();
        const statusColorMap = {
            'nuevo': 'status-ready',
            'contactado': 'status-badge-contactado',
            'respondio': 'status-badge-respondio',
            'interesado': 'status-badge-interesado',
            'propuesta_enviada': 'status-badge-propuesta',
            'seguimiento': 'status-badge-seguimiento',
            'cerrado_ganado': 'status-badge-ganado',
            'cerrado_perdido': 'status-badge-perdido',
            'descartado': 'status-badge-descartado',
        };
        const statusClass = statusColorMap[estadoVal] || 'status-ready';

        tr.innerHTML = `
            <td class="text-muted">${start + localIndex + 1}</td>
            <td><strong>${lead.nombre_negocio || '-'}</strong></td>
            <td><span class="integration-badge">${lead.categoria || '-'}</span></td>
            <td>${displayPhone}</td>
            <td>${lead.score || '-'}</td>
            <td class="${priorityClass}"><strong>${lead.prioridad || '-'}</strong></td>
            <td><span class="status-badge ${statusClass}">${estadoVal}</span></td>
            <td>${lead.fecha_ultimo_contacto ? new Date(lead.fecha_ultimo_contacto).toLocaleDateString() : '-'}</td>
            <td>${lead.fecha_proximo_seguimiento ? new Date(lead.fecha_proximo_seguimiento).toLocaleDateString() : '-'}</td>
            <td class="col-actions">
                <div class="actions-wrapper">
                    <button class="btn btn-ghost btn-sm" title="Ver Perfil" onclick="openProfileByGlobalIndex(${globalIndex})">
                        <i data-lucide="eye"></i>
                    </button>
                    <button class="btn btn-ghost btn-sm text-error" title="Eliminar Lead" onclick="deleteLeadByGlobalIndex(${globalIndex})">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    lucide.createIcons();
    renderCrmPagination(dataToRender.length, totalPages);
}

function renderCrmPagination(totalItems, totalPages) {
    const container = document.getElementById('crm-pagination');
    container.innerHTML = '';

    if (totalPages <= 1) return;

    const info = document.createElement('span');
    info.className = 'crm-page-info';
    info.textContent = `Página ${crmCurrentPage} de ${totalPages} (${totalItems} leads)`;

    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn btn-ghost btn-sm crm-page-btn';
    prevBtn.innerHTML = '<i data-lucide="chevron-left"></i> Anterior';
    prevBtn.disabled = crmCurrentPage === 1;
    prevBtn.addEventListener('click', () => {
        if (crmCurrentPage > 1) {
            crmCurrentPage--;
            applyFiltersAndRender();
        }
    });

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-ghost btn-sm crm-page-btn';
    nextBtn.innerHTML = 'Siguiente <i data-lucide="chevron-right"></i>';
    nextBtn.disabled = crmCurrentPage === totalPages;
    nextBtn.addEventListener('click', () => {
        if (crmCurrentPage < totalPages) {
            crmCurrentPage++;
            applyFiltersAndRender();
        }
    });

    // Page number buttons (show max 5 around current)
    const pagesWrapper = document.createElement('div');
    pagesWrapper.className = 'crm-page-numbers';
    
    let startPage = Math.max(1, crmCurrentPage - 2);
    let endPage = Math.min(totalPages, crmCurrentPage + 2);
    if (endPage - startPage < 4) {
        if (startPage === 1) endPage = Math.min(5, totalPages);
        else startPage = Math.max(1, endPage - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `btn btn-sm crm-page-num ${i === crmCurrentPage ? 'btn-primary' : 'btn-ghost'}`;
        pageBtn.textContent = i;
        const pageNum = i;
        pageBtn.addEventListener('click', () => {
            crmCurrentPage = pageNum;
            applyFiltersAndRender();
        });
        pagesWrapper.appendChild(pageBtn);
    }

    container.appendChild(prevBtn);
    container.appendChild(pagesWrapper);
    container.appendChild(info);
    container.appendChild(nextBtn);
    lucide.createIcons();
}

window.openProfileByGlobalIndex = function(globalIndex) {
    if (globalIndex < 0 || globalIndex >= crmData.length) return;
    const lead = crmData[globalIndex];
    openProfile(lead);
};

window.deleteLeadByGlobalIndex = function(globalIndex) {
    if (globalIndex < 0 || globalIndex >= crmData.length) return;
    const lead = crmData[globalIndex];
    const name = lead ? lead.nombre_negocio : 'este lead';
    if(confirm(`¿Estás seguro de que deseas eliminar a "${name}" de la vista? (Para borrarlo de Google Sheets de forma permanente, debes hacerlo manualmente en el archivo).`)) {
        crmData.splice(globalIndex, 1);
        crmCurrentPage = 1;
        applyFiltersAndRender();
        showToast('Lead eliminado de la vista local', 'success');
    }
};

document.getElementById('delete-all-crm-btn')?.addEventListener('click', () => {
    if(crmData.length === 0) return;
    if(confirm('¿Eliminar TODOS los leads cargados en pantalla? (Recuerda que para borrarlos permanentemente debes limpiar tu Google Sheet).')) {
        crmData = [];
        crmCurrentPage = 1;
        applyFiltersAndRender();
        showToast('Todos los leads fueron eliminados de la vista', 'success');
    }
});

// CRM Filters Logic
document.querySelectorAll('.crm-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.crm-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        crmActiveFilter = btn.getAttribute('data-filter');
        crmCurrentPage = 1;
        applyFiltersAndRender();
    });
});

// Phone Search Logic
const searchInput = document.getElementById('crm-phone-search');
if (searchInput) {
    const handleSearch = (e) => {
        // Ejecutar en el siguiente tick para asegurar que el valor ya se pegó
        setTimeout(() => {
            crmSearchQuery = e.target.value;
            crmCurrentPage = 1;
            applyFiltersAndRender();
        }, 0);
    };
    searchInput.addEventListener('input', handleSearch);
    searchInput.addEventListener('paste', handleSearch);
    searchInput.addEventListener('keyup', handleSearch);
}

document.getElementById('refresh-crm-btn')?.addEventListener('click', () => {
    crmSearchQuery = '';
    const searchInput = document.getElementById('crm-phone-search');
    if (searchInput) searchInput.value = '';
    crmCurrentPage = 1;
    fetchCrmData();
});


// ==========================================
// LEAD PROFILE PANEL (Fase 4)
// ==========================================
let currentActiveLead = null;

function openProfile(lead) {
    if(!lead) return;
    currentActiveLead = lead;

    // Clean up display phone
    let displayPhone = lead.telefono || '';
    if (!displayPhone || displayPhone.includes('ERROR') || displayPhone.trim() === '-' || displayPhone.trim() === 'Sin teléfono') {
        displayPhone = 'Sin teléfono';
    }

    // Populate Info
    document.getElementById('profile-name').textContent = lead.nombre_negocio || 'Sin Nombre';
    document.getElementById('prof-address').textContent = lead.direccion || 'Sin dirección';
    document.getElementById('prof-phone').textContent = displayPhone;
    
    let webHtml = '-';
    if (lead.sitio_web && lead.sitio_web.trim() !== '') {
        let url = lead.sitio_web;
        if (!url.startsWith('http')) url = 'https://' + url;
        webHtml = `<a href="${url}" target="_blank" style="color: var(--accent-color); text-decoration: underline;">${lead.sitio_web}</a>`;
    } else if (lead.estado_web && lead.estado_web.trim() !== '') {
        webHtml = `${lead.estado_web} <span style="font-size: 0.85em; color: var(--text-muted);">(URL no provista)</span>`;
    }
    document.getElementById('prof-web').innerHTML = webHtml;
    
    let instaVal = lead.instagram || lead.url_instagram || lead.redes_sociales || lead.tiene_instagram || '-';
    if (instaVal !== '-' && instaVal.toLowerCase() !== 'no' && instaVal.toLowerCase() !== 'false') {
        if (instaVal.startsWith('http')) {
            instaVal = `<a href="${instaVal}" target="_blank" style="color: var(--accent-color); text-decoration: underline;">Ver Perfil</a>`;
        } else if (instaVal.startsWith('@')) {
            instaVal = `<a href="https://instagram.com/${instaVal.substring(1)}" target="_blank" style="color: var(--accent-color); text-decoration: underline;">${instaVal}</a>`;
        } else if (instaVal.toLowerCase() === 'sí' || instaVal.toLowerCase() === 'si' || instaVal.toLowerCase() === 'true') {
            instaVal = 'Sí tiene';
        }
    }
    document.getElementById('prof-instagram').innerHTML = instaVal;
    
    const priorSpan = document.getElementById('prof-prioridad');
    if (priorSpan) {
        priorSpan.textContent = lead.prioridad || '-';
        if (lead.prioridad === 'Alta') priorSpan.style.color = 'var(--success-color, #10b981)';
        else if (lead.prioridad === 'Baja') priorSpan.style.color = 'var(--error-color, #ef4444)';
        else priorSpan.style.color = 'inherit';
    }

    let ratingVal = lead.rating != null ? String(lead.rating) : '-';
    if (ratingVal.includes('T00:00:00') || ratingVal.includes('T05:00:00')) {
        const d = new Date(ratingVal);
        if (!isNaN(d.getTime())) {
            ratingVal = `${d.getDate()}.${d.getMonth() + 1}`;
        }
    }
    document.getElementById('prof-rating').textContent = ratingVal;
    document.getElementById('prof-reviews').textContent = lead.reviews || '0';

    const estadoSelect = document.getElementById('prof-estado');
    if (estadoSelect) {
        estadoSelect.value = (lead.estado_comercial || 'nuevo').toLowerCase();
    }

    // Populate AI Analysis
    document.getElementById('prof-ai-analysis').textContent = lead.analisis_ia || 'Sin análisis de IA.';
    document.getElementById('prof-ai-message').value = lead.mensaje || '';
    
    // Toggle WhatsApp button
    const waBtn = document.getElementById('btn-open-whatsapp');
    const hasValidPhone = lead.telefono && !lead.telefono.includes('ERROR') && lead.telefono.trim() !== '' && lead.telefono.trim() !== '-' && lead.telefono.trim() !== 'Sin teléfono';
    if (hasValidPhone) {
        waBtn.classList.remove('hide');
        const waNumber = lead.telefono.replace(/[^0-9]/g, '');
        waBtn.href = `https://wa.me/${waNumber}`;
    } else {
        waBtn.classList.add('hide');
    }

    // Populate History
    document.getElementById('prof-import-date').textContent = lead.fecha_importacion ? new Date(lead.fecha_importacion).toLocaleDateString() : '-';
    document.getElementById('prof-last-contact').textContent = lead.fecha_ultimo_contacto ? new Date(lead.fecha_ultimo_contacto).toLocaleDateString() : 'Nunca';
    document.getElementById('prof-notes').value = lead.notas || '';
    
    // Populate Saved Note Display
    const savedNoteContainer = document.getElementById('saved-note-container');
    const savedNoteText = document.getElementById('prof-saved-note-text');
    if (lead.notas && lead.notas.trim() !== '') {
        savedNoteText.textContent = lead.notas;
        savedNoteContainer.classList.remove('hide');
    } else {
        savedNoteText.textContent = '';
        savedNoteContainer.classList.add('hide');
    }

    // Show Panel
    document.getElementById('profile-overlay').classList.remove('hide');
    setTimeout(() => {
        document.getElementById('profile-panel').classList.add('open');
    }, 10);
}

function closeProfile() {
    document.getElementById('profile-panel').classList.remove('open');
    setTimeout(() => {
        document.getElementById('profile-overlay').classList.add('hide');
    }, 300);
}

document.getElementById('close-profile-btn').addEventListener('click', closeProfile);
document.getElementById('profile-overlay').addEventListener('click', closeProfile);

// Profile Tabs Logic
document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.add('hide'));
        document.getElementById('ptab-' + tab.getAttribute('data-tab')).classList.remove('hide');
    });
});

// Update Estado Localmente
document.getElementById('prof-estado')?.addEventListener('change', (e) => {
    if (!currentActiveLead) return;
    
    const newState = e.target.value;
    currentActiveLead.estado_comercial = newState;
    
    // Si la fecha de contacto no existe y lo pasa a contactado, podrías ponerla
    if(newState === 'contactado' && !currentActiveLead.fecha_ultimo_contacto) {
        currentActiveLead.fecha_ultimo_contacto = new Date().toISOString();
        document.getElementById('prof-last-contact').textContent = new Date(currentActiveLead.fecha_ultimo_contacto).toLocaleDateString();
    }

    // Refresh table and filters
    const activeBtn = document.querySelector('.crm-filter-btn.active');
    if(activeBtn) {
        const filterValue = activeBtn.getAttribute('data-filter');
        if(filterValue === 'todos') {
            renderCrmTable(crmData);
        } else {
            const filtered = crmData.filter(l => (l.estado_comercial || '').toLowerCase() === filterValue.toLowerCase());
            renderCrmTable(filtered);
        }
    } else {
        renderCrmTable(crmData);
    }
    
    // Send update to server
    updateLeadInSheets(currentActiveLead);
});

// Phase 5: Generar Mensaje IA
document.getElementById('btn-generate-msg')?.addEventListener('click', async () => {
    if(!currentActiveLead) return;

    const btn = document.getElementById('btn-generate-msg');
    const textArea = document.getElementById('prof-ai-message');
    
    // UI Loading state
    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Generando...';
    lucide.createIcons();

    try {
        const response = await fetch('http://localhost:4000/api/generate-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                negocio: currentActiveLead.nombre_negocio,
                categoria: currentActiveLead.categoria,
                rating: currentActiveLead.rating,
                reviews: currentActiveLead.reviews,
                analisis: currentActiveLead.analisis_ia,
                instagram: currentActiveLead.tiene_instagram,
                web: currentActiveLead.sitio_web || currentActiveLead.estado_web
            })
        });

        if(!response.ok) throw new Error('Error en API');
        const data = await response.json();
        
        textArea.value = data.mensaje;
        showToast('Mensaje generado con éxito', 'success');
        
        // Phase 6: Update WhatsApp link
        const waBtn = document.getElementById('btn-open-whatsapp');
        if (currentActiveLead.telefono) {
            const waNumber = currentActiveLead.telefono.replace(/[^0-9]/g, '');
            const encodedMsg = encodeURIComponent(data.mensaje);
            waBtn.href = `https://wa.me/${waNumber}?text=${encodedMsg}`;
            
            // Add event listener to update CRM status when clicked
            waBtn.onclick = () => {
                showToast('Lead movido a "Contactado"', 'info');
                // En un sistema real, aquí haríamos un POST para actualizar Google Sheets con el nuevo estado
            };
        }

    } catch (error) {
        console.error(error);
        showToast('Error al generar el mensaje', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
        lucide.createIcons();
    }
});

// Guardar notas localmente y en Sheets
document.getElementById('btn-save-notes')?.addEventListener('click', () => {
    if (!currentActiveLead) return;
    
    const notesArea = document.getElementById('prof-notes');
    if (notesArea) {
        currentActiveLead.notas = notesArea.value;
        
        // Update visual display
        const savedNoteContainer = document.getElementById('saved-note-container');
        const savedNoteText = document.getElementById('prof-saved-note-text');
        if (currentActiveLead.notas.trim() !== '') {
            savedNoteText.textContent = currentActiveLead.notas;
            savedNoteContainer.classList.remove('hide');
        } else {
            savedNoteContainer.classList.add('hide');
        }
        
        updateLeadInSheets(currentActiveLead);
    }
});

// Función central para actualizar en Google Sheets
async function updateLeadInSheets(lead) {
    const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzLghbWOdMCtge-OvTGRoVqluQmwsjGYFXZBjMpyIGxW_Ns7QIs3uYFVDSkdUOqJD1N/exec';
    
    try {
        showToast('Guardando en Google Sheets...', 'info');
        const response = await fetch('http://localhost:4000/api/sheets/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                webhookUrl: WEBHOOK_URL,
                payload: { lead }
            })
        });

        if (!response.ok) throw new Error('Error de red al actualizar');
        
        const responseData = await response.json();
        
        // Revisamos si el webhook retornó un JSON con "success": false
        if (responseData.data && responseData.data.success === false) {
            console.error("Webhook Error:", responseData.data.error);
            showToast('Error del Webhook: ' + (responseData.data.error || 'Desconocido'), 'error');
            return;
        }

        showToast('Actualizado correctamente en Google Sheets', 'success');
    } catch (err) {
        console.error(err);
        showToast('Error al actualizar en Sheets.', 'error');
    }
}
