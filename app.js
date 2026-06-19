// Helper: escape HTML tags for code blocks
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Custom Markdown to HTML regex parser
function parseMarkdown(md) {
    if (!md) return "";
    let html = md;

    // Convert code blocks
    html = html.replace(/```(.*?)\n([\s\S]*?)```/g, function(match, lang, code) {
        return `<pre><code class="${lang}">${escapeHtml(code.trim())}</code></pre>`;
    });

    // Convert inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Convert Github alerts
    html = html.replace(/>\s*\[!(NOTE|IMPORTANT|WARNING|CAUTION)\]\s*\n([\s\S]*?)(?=\n\n|\n[^\s>])/g, function(match, type, content) {
        const title = type.charAt(0) + type.slice(1).toLowerCase();
        let icon = 'fa-info-circle';
        if (type === 'IMPORTANT') icon = 'fa-circle-exclamation';
        if (type === 'WARNING') icon = 'fa-triangle-exclamation';
        if (type === 'CAUTION') icon = 'fa-circle-radiation';
        
        let cleanedContent = content.split('\n').map(line => line.replace(/^\s*>\s*/, '')).join('<br>');
        return `<div class="alert-block ${type.toLowerCase()}">
            <div class="alert-title"><i class="fa-solid ${icon}"></i> ${title}</div>
            <p>${cleanedContent}</p>
        </div>`;
    });

    // Convert tables
    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = "";
    let newLines = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (line.startsWith('|')) {
            if (!inTable) {
                inTable = true;
                tableHtml = "<table>";
                const cols = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
                tableHtml += "<thead><tr>" + cols.map(c => `<th>${c}</th>`).join('') + "</tr></thead><tbody>";
                if (i + 1 < lines.length && lines[i+1].includes('---')) {
                    i++; // Skip separator line
                }
            } else {
                const cols = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
                tableHtml += "<tr>" + cols.map(c => `<td>${c}</td>`).join('') + "</tr>";
            }
        } else {
            if (inTable) {
                inTable = false;
                tableHtml += "</tbody></table>";
                newLines.push(tableHtml);
            }
            newLines.push(lines[i]);
        }
    }
    if (inTable) {
        tableHtml += "</tbody></table>";
        newLines.push(tableHtml);
    }
    html = newLines.join('\n');

    // Headers
    html = html.replace(/^#### (.*?)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

    // Horizontal Rule
    html = html.replace(/^---$/gm, '<hr>');

    // Lists (unordered)
    html = html.replace(/^\*\s+(.*?)$/gm, '<li>$1</li>');
    html = html.replace(/^-\s+(.*?)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, ''); // merge adjacent lists

    // Bold & Italic
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Links: [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    return html;
}

// Toast Notification Manager
function showToast(message) {
    const existing = document.querySelector('.toast-msg');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Copy helper
function copyToClipboard(text, element) {
    navigator.clipboard.writeText(text).then(() => {
        showToast("Copied to clipboard!");
        if (element) {
            element.classList.add('copied');
            const origHTML = element.innerHTML;
            element.innerHTML = `<i class="fa-solid fa-check"></i> Copied`;
            setTimeout(() => {
                element.classList.remove('copied');
                element.innerHTML = origHTML;
            }, 2000);
        }
    }).catch(err => {
        console.error("Failed to copy text: ", err);
    });
}

// Application State
const state = {
    currentSection: 'dashboard',
    currentSubKey: null,
    theme: 'dark'
};

// DOM Elements
const sidebar = document.getElementById('app-sidebar');
const mainContent = document.getElementById('app-main');
const breadcrumbParent = document.getElementById('breadcrumb-parent');
const breadcrumbCurrent = document.getElementById('breadcrumb-current');
const viewDashboard = document.getElementById('view-dashboard');
const viewDocument = document.getElementById('view-document');
const docTabsBar = document.getElementById('doc-tabs-bar');
const docMarkdownContent = document.getElementById('doc-markdown-content');
const docInteractiveSlot = document.getElementById('doc-interactive-slot');
const globalSearchInput = document.getElementById('global-search-input');
const searchResultsBox = document.getElementById('search-results-box');
const toolsDropdownMenu = document.getElementById('tools-dropdown-menu');
const toolsModal = document.getElementById('tools-modal');
const modalTitle = document.getElementById('modal-title');
const modalBodyContent = document.getElementById('modal-body-content');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupTheme();
    setupSearch();
    setupQuickTools();
    setupDashboardClicks();
    
    // Default view
    navigateTo('dashboard');
});

// Theme Toggle Setup
function setupTheme() {
    const btn = document.getElementById('theme-toggle-btn');
    const logoImg = document.getElementById('sidebar-logo');
    btn.addEventListener('click', () => {
        if (document.body.classList.contains('dark-theme')) {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
            state.theme = 'light';
            if (logoImg) logoImg.src = 'hb%20logo.png';
        } else {
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
            state.theme = 'dark';
            if (logoImg) logoImg.src = 'hb%20logo%20dark%20mode.svg';
        }
    });
}

// Navigation Handling
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            navItems.forEach(ni => ni.classList.remove('active'));
            item.classList.add('active');
            navigateTo(target);
        });
    });

    // Mobile sidebar toggle
    const toggleBtn = document.getElementById('sidebar-toggle');
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-active');
    });

    // Close mobile sidebar on click outside
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 && !sidebar.contains(e.target) && e.target !== toggleBtn && !toggleBtn.contains(e.target)) {
            sidebar.classList.remove('mobile-active');
        }
    });
}

// Router logic
function navigateTo(section, subKey = null) {
    state.currentSection = section;
    state.currentSubKey = subKey;
    sidebar.classList.remove('mobile-active');

    // Close any tools modal
    closeModal();

    if (section === 'dashboard') {
        breadcrumbParent.textContent = 'Portal';
        breadcrumbCurrent.textContent = 'Dashboard';
        viewDashboard.classList.add('active');
        viewDocument.classList.remove('active');
        viewDocument.style.display = 'none';
        
        // Update active sidebar class
        document.querySelectorAll('.nav-item').forEach(ni => ni.classList.remove('active'));
        document.getElementById('nav-dashboard').classList.add('active');
        return;
    }

    // Set breadcrumbs
    const sidebarItem = document.querySelector(`.nav-item[data-target="${section}"]`);
    if (sidebarItem) {
        document.querySelectorAll('.nav-item').forEach(ni => ni.classList.remove('active'));
        sidebarItem.classList.add('active');
        breadcrumbParent.textContent = sidebarItem.textContent.trim();
    }

    viewDashboard.classList.remove('active');
    viewDocument.style.display = 'block';
    viewDocument.classList.add('active');

    renderDocumentView(section, subKey);
}

// Render document files inside the hub
function renderDocumentView(section, subKey = null) {
    docTabsBar.innerHTML = "";
    docInteractiveSlot.style.display = "none";
    docInteractiveSlot.innerHTML = "";
    document.querySelector('.doc-body-wrapper').classList.remove('with-widget');

    const sectionData = PARTNER_DATA[section];
    if (!sectionData) {
        docMarkdownContent.innerHTML = `<h1>Content Not Found</h1><p>The section data is missing.</p>`;
        return;
    }

    // Determine subkeys and render tab selectors
    let keys = [];
    if (Array.isArray(sectionData)) {
        // Marketing campaigns toolkit
        keys = sectionData.map(c => ({ key: c.id, label: c.name }));
    } else {
        // Standard object sections
        keys = Object.keys(sectionData).map(k => {
            let label = k.replace(/_/g, ' ');
            label = label.charAt(0).toUpperCase() + label.slice(1);
            return { key: k, label: label };
        });
    }

    // Active key
    const activeKey = subKey || keys[0].key;
    state.currentSubKey = activeKey;

    // Render Tabs
    keys.forEach(k => {
        const tab = document.createElement('div');
        tab.className = `doc-tab ${k.key === activeKey ? 'active' : ''}`;
        tab.textContent = k.label;
        tab.addEventListener('click', () => {
            renderDocumentSubView(section, k.key);
        });
        docTabsBar.appendChild(tab);
    });

    renderDocumentSubView(section, activeKey);
}

// Custom parser and layout generator for client success case studies
function renderCaseStudiesHTML(markdown) {
    if (!markdown) return "";
    
    // Extract the main heading
    let headingMatch = markdown.match(/# (.*?)(?=\n)/);
    let headingHtml = "";
    if (headingMatch) {
        // Convert to HTML heading
        headingHtml = parseMarkdown(headingMatch[0]);
    } else {
        headingHtml = "<h1>Client Success Case Studies</h1>";
    }
    
    // Split the rest by ##
    let parts = markdown.split(/\n## /);
    let caseStudies = [];
    
    for (let i = 1; i < parts.length; i++) {
        let part = parts[i];
        let lines = part.split('\n');
        let titleLine = lines[0].trim(); // e.g. "1. [Inde Hotels & Resorts (Hospitality Vertical)](url)"
        
        // Clean title prefix
        let cleanTitle = titleLine.replace(/^\d+\.\s*/, ''); // remove number prefix
        
        let url = "https://www.hostbooks.com/in/case-study/";
        let linkMatch = cleanTitle.match(/\[(.*?)\]\((.*?)\)/);
        if (linkMatch) {
            cleanTitle = linkMatch[1];
            url = linkMatch[2];
        }
        
        let clientOverview = "";
        let challenge = "";
        let solution = "";
        let impact = "";
        
        // Join remaining lines to extract fields using regex
        let bodyText = lines.slice(1).join('\n');
        
        // Extract fields
        let overviewMatch = bodyText.match(/\*\*Client Overview:\*\*(.*?)(?=\n\*|\n##|$)/s);
        let challengeMatch = bodyText.match(/\*\*The Challenge:\*\*(.*?)(?=\n\*|\n##|$)/s);
        let solutionMatch = bodyText.match(/\*\*Solution Implemented:\*\*(.*?)(?=\n\*|\n##|$)/s);
        let impactMatch = bodyText.match(/\*\*The Impact:\*\*(.*?)(?=\n\*|\n##|$)/s);
        
        if (overviewMatch) clientOverview = overviewMatch[1].trim();
        if (challengeMatch) challenge = challengeMatch[1].trim();
        if (solutionMatch) solution = solutionMatch[1].trim();
        if (impactMatch) impact = impactMatch[1].trim();
        
        // Remove leading bullet characters
        clientOverview = clientOverview.replace(/^[\s*\-]+/, '').trim();
        challenge = challenge.replace(/^[\s*\-]+/, '').trim();
        solution = solution.replace(/^[\s*\-]+/, '').trim();
        impact = impact.replace(/^[\s*\-]+/, '').trim();
        
        // Remove bold wrapper inside impact string if present to handle clean text rendering
        impact = impact.replace(/^\*\*|\*\*$/g, '');
        
        caseStudies.push({
            title: cleanTitle,
            url: url,
            overview: clientOverview,
            challenge: challenge,
            solution: solution,
            impact: impact
        });
    }
    
    // Now render them
    let gridHtml = `<div class="cases-grid">`;
    caseStudies.forEach((cs, idx) => {
        const isFeatured = idx < 4; // First 4 are bigger!
        const cardClass = isFeatured ? 'case-card featured' : 'case-card';
        
        // Extract category if in parentheses
        let category = "";
        let nameOnly = cs.title;
        let catMatch = cs.title.match(/\((.*?)\)/);
        if (catMatch) {
            category = catMatch[1];
            nameOnly = cs.title.replace(/\(.*?\)/, '').trim();
        }
        
        // Determine icons
        let iconHtml = '<i class="fa-solid fa-briefcase"></i>';
        let lowerCat = category.toLowerCase();
        if (lowerCat.includes('hospitality') || lowerCat.includes('hotel')) {
            iconHtml = '<i class="fa-solid fa-hotel"></i>';
        } else if (lowerCat.includes('manufacturing') || lowerCat.includes('scm')) {
            iconHtml = '<i class="fa-solid fa-industry"></i>';
        } else if (lowerCat.includes('sweet') || lowerCat.includes('bakery') || lowerCat.includes('confectionery')) {
            iconHtml = '<i class="fa-solid fa-cookie-bite"></i>';
        } else if (lowerCat.includes('machinery') || lowerCat.includes('robotic') || lowerCat.includes('automation')) {
            iconHtml = '<i class="fa-solid fa-robot"></i>';
        } else if (lowerCat.includes('construction') || lowerCat.includes('real estate')) {
            iconHtml = '<i class="fa-solid fa-trowel-bricks"></i>';
        }
        
        gridHtml += `
            <a href="${cs.url}" target="_blank" class="${cardClass}">
                <div class="case-card-header">
                    <span class="case-badge">${category || 'Enterprise Client'}</span>
                    <div class="case-icon">${iconHtml}</div>
                </div>
                <h3 class="case-title">${nameOnly}</h3>
                
                <div class="case-section overview">
                    <span class="section-label"><i class="fa-solid fa-circle-info"></i> Client Overview</span>
                    <p class="section-text">${cs.overview}</p>
                </div>
                
                <div class="case-details-grid">
                    <div class="case-section challenge">
                        <span class="section-label"><i class="fa-solid fa-triangle-exclamation"></i> The Challenge</span>
                        <p class="section-text">${cs.challenge}</p>
                    </div>
                    <div class="case-section solution">
                        <span class="section-label"><i class="fa-solid fa-check-double"></i> Solution Implemented</span>
                        <p class="section-text">${cs.solution}</p>
                    </div>
                </div>
                
                <div class="case-section impact">
                    <span class="section-label"><i class="fa-solid fa-chart-line"></i> Business Impact</span>
                    <p class="section-text"><strong>${cs.impact}</strong></p>
                </div>
            </a>
        `;
    });
    gridHtml += `</div>`;
    
    return `<div class="case-studies-container">
        ${gridHtml}
    </div>`;
}

// Custom parser and layout generator for training playlists
function renderTrainingHTML(markdown) {
    if (!markdown) return "";
    
    // Split by the playlist heading if present
    let parts = markdown.split(/\n# \[Official HostBooks Video Playlists/);
    let curriculumHtml = parseMarkdown(parts[0]);
    
    if (parts.length < 2) {
        return curriculumHtml;
    }
    
    // Process playlists
    let playlistsPart = "# [Official HostBooks Video Playlists" + parts[1];
    
    // Extract main heading
    let headingMatch = playlistsPart.match(/# (.*?)(?=\n)/);
    let headingHtml = "";
    if (headingMatch) {
        headingHtml = parseMarkdown(headingMatch[0]);
    } else {
        headingHtml = "<h2>Official YouTube Playlists</h2>";
    }
    
    // Extract playlist lines
    let lines = playlistsPart.split('\n');
    let playlistItems = [];
    
    lines.forEach(line => {
        if (line.trim().startsWith('##')) {
            // e.g. "## 1. [HostBooks ERP360 & SCM Tutorials](url)"
            let cleanLine = line.replace(/^##\s*(?:\d+\.\s*)?/, '').trim();
            let linkMatch = cleanLine.match(/\[(.*?)\]\((.*?)\)/);
            if (linkMatch) {
                playlistItems.push({
                    title: linkMatch[1],
                    url: linkMatch[2]
                });
            }
        }
    });
    
    // Now render playlists as tiles
    let gridHtml = `<div class="playlists-grid">`;
    playlistItems.forEach((pl, idx) => {
        // Determine color theme / badge for each
        let iconHtml = '<i class="fa-brands fa-youtube"></i>';
        let descText = "";
        let lowerTitle = pl.title.toLowerCase();
        
        if (lowerTitle.includes('erp') || lowerTitle.includes('scm')) {
            iconHtml = '<i class="fa-solid fa-industry"></i>';
            descText = "Configure Multi-Warehouse SCM, multi-level BOM, and work-in-progress scheduling.";
        } else if (lowerTitle.includes('pos') || lowerTitle.includes('aahar') || lowerTitle.includes('management')) {
            iconHtml = '<i class="fa-solid fa-cookie-bite"></i>';
            descText = "Get enabled on Aahar POS billing systems, recipe control, and central kitchen replenishment.";
        } else if (lowerTitle.includes('unfiltered')) {
            iconHtml = '<i class="fa-solid fa-comments"></i>';
            descText = "Dive into industry insights, eco-innovation challenges, and partner program benefits.";
        } else if (lowerTitle.includes('gst') || lowerTitle.includes('compliance')) {
            iconHtml = '<i class="fa-solid fa-scale-balanced"></i>';
            descText = "Walkthrough GSTR filing interfaces, GSTR-2B reconciliations, and direct ASP/GSP compliance.";
        }
        
        gridHtml += `
            <a href="${pl.url}" target="_blank" class="playlist-tile">
                <div class="playlist-tile-header">
                    <div class="playlist-icon">${iconHtml}</div>
                    <span class="youtube-tag"><i class="fa-brands fa-youtube"></i> PLAYLIST</span>
                </div>
                <h3 class="playlist-title">${pl.title}</h3>
                <p class="playlist-desc">${descText}</p>
                <div class="playlist-tile-footer">
                    <span>Watch Tutorial <i class="fa-solid fa-arrow-up-right-from-square"></i></span>
                </div>
            </a>
        `;
    });
    gridHtml += `</div>`;
    
    return `
        <div class="training-container">
            ${curriculumHtml}
            <div class="playlists-section-container" style="margin-top: 40px; border-top: 1px solid var(--border-color); padding-top: 30px;">
                ${headingHtml}
                ${gridHtml}
            </div>
        </div>
    `;
}

// Custom parser and layout generator for downloadable templates & worksheets
function renderTemplatesHTML(markdown) {
    if (!markdown) return "";
    
    let headingMatch = markdown.match(/# (.*?)(?=\n)/);
    let headingHtml = "";
    if (headingMatch) {
        headingHtml = `<h1>${headingMatch[1]}</h1>`;
    } else {
        headingHtml = "<h1>Standard Templates & Worksheets</h1>";
    }
    
    let lines = markdown.split('\n');
    let templateItems = [];
    
    lines.forEach(line => {
        line = line.trim();
        if (line.match(/^\d+\.\s+\[(.*?)\]\((.*?)\)/) || line.match(/^-\s+\[(.*?)\]\((.*?)\)/)) {
            let match = line.match(/\[(.*?)\]\((.*?)\)/);
            if (match) {
                templateItems.push({
                    title: match[1],
                    url: match[2]
                });
            }
        }
    });

    if (templateItems.length === 0) {
        return parseMarkdown(markdown);
    }
    
    let gridHtml = `<div class="templates-grid">`;
    templateItems.forEach(item => {
        // Decode URL to display a clean filename
        let decodedUrl = decodeURIComponent(item.url);
        let fileName = decodedUrl.split('/').pop();
        let ext = fileName.split('.').pop().toLowerCase();
        
        let iconHtml = '<i class="fa-solid fa-file-lines"></i>';
        let badgeClass = 'badge-other';
        let badgeText = 'DOCUMENT';
        let actionText = 'Download Template';
        let downloadAttr = 'download';
        let targetAttr = '';
        
        if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
            iconHtml = '<i class="fa-solid fa-file-excel" style="color: #107c41;"></i>';
            badgeClass = 'badge-excel';
            badgeText = 'EXCEL WORKBOOK';
            actionText = 'Download Excel';
        } else if (ext === 'ppt' || ext === 'pptx') {
            iconHtml = '<i class="fa-solid fa-file-powerpoint" style="color: #c43e1c;"></i>';
            badgeClass = 'badge-powerpoint';
            badgeText = 'SLIDE DECK';
            actionText = 'Download PowerPoint';
        } else if (ext === 'doc' || ext === 'docx') {
            iconHtml = '<i class="fa-solid fa-file-word" style="color: #185abd;"></i>';
            badgeClass = 'badge-word';
            badgeText = 'WORD DOCUMENT';
            actionText = 'Download Document';
            downloadAttr = 'download';
            targetAttr = '';
        } else if (ext === 'md' || ext === 'txt') {
            iconHtml = '<i class="fa-solid fa-file-signature" style="color: #0078d4;"></i>';
            badgeClass = 'badge-doc';
            badgeText = 'MARKDOWN';
            actionText = 'View Script';
            downloadAttr = '';
            targetAttr = 'target="_blank"';
        }
        
        let description = "Download and customize this HostBooks resources template for your operations.";
        if (item.title.includes("Outreach")) {
            description = "A standard campaign outreach script for targeting prospect clients and executing email/WhatsApp sequences.";
        } else if (item.title.includes("Discovery")) {
            description = "Detailed questionnaire template to gather client system landscape, finance, supply chain, and HR/payroll requirements.";
        } else if (item.title.includes("BRD") || item.title.includes("Mapping")) {
            description = "Framework to map client pain point mapping and Business Requirements Document (BRD) structures.";
        } else if (item.title.includes("QBR")) {
            description = "Quarterly Business Review slide deck template to present business health and ERP return-on-investment.";
        }
        
        gridHtml += `
            <div class="template-card">
                <div class="template-card-header">
                    <div class="template-icon-wrapper">
                        ${iconHtml}
                    </div>
                    <span class="file-badge ${badgeClass}">${badgeText}</span>
                </div>
                <div class="template-card-body">
                    <h3>${item.title}</h3>
                    <p>${description}</p>
                    <div class="template-filename">
                        <i class="fa-solid fa-paperclip"></i> <code>${fileName}</code>
                    </div>
                </div>
                <div class="template-card-footer">
                    <a href="${item.url}" ${downloadAttr} ${targetAttr} class="btn btn-download-template">
                        <i class="fa-solid fa-download"></i> ${actionText}
                    </a>
                </div>
            </div>
        `;
    });
    gridHtml += `</div>`;
    
    return `
        <div class="templates-view-container">
            ${headingHtml}
            <p class="templates-intro-text">Access worksheets, configuration guidelines, and bulk data migration templates to accelerate deployment cycles and streamline client onboarding.</p>
            ${gridHtml}
        </div>
    `;
}

// Render individual files & embed interactive tools dynamically
function renderDocumentSubView(section, subKey) {
    state.currentSubKey = subKey;
    
    // Update active tab visual
    document.querySelectorAll('.doc-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.textContent.toLowerCase() === subKey.replace(/_/g, ' ').toLowerCase()) {
            tab.classList.add('active');
        }
    });

    breadcrumbCurrent.textContent = subKey.replace(/_/g, ' ').toUpperCase();

    const sectionData = PARTNER_DATA[section];
    let content = "";
    let renderWidget = null;

    if (section === 'marketing') {
        const campaign = sectionData.find(c => c.id === subKey);
        if (campaign) {
            content = renderMarketingCampaignHTML(campaign);
        }
    } else if (section === 'case_studies') {
        const rawContent = sectionData[subKey];
        if (typeof rawContent === 'string') {
            content = renderCaseStudiesHTML(rawContent);
        }
    } else if (section === 'training') {
        const rawContent = sectionData[subKey];
        if (typeof rawContent === 'string') {
            content = renderTrainingHTML(rawContent);
        }
    } else if (section === 'templates') {
        const rawContent = sectionData[subKey];
        if (typeof rawContent === 'string') {
            content = renderTemplatesHTML(rawContent);
        }
    } else {
        const rawContent = sectionData[subKey];
        if (typeof rawContent === 'string') {
            content = parseMarkdown(rawContent);
        } else if (Array.isArray(rawContent) && subKey === 'objections') {
            // Render objection handling interface directly in the document page!
            content = `<h1>Interactive Objection handling Battlecards</h1><p>Search and inspect objections raised by clients or competitor claims.</p>`;
            renderWidget = () => renderObjectionsTool(docInteractiveSlot);
        } else if (Array.isArray(rawContent) && subKey === 'discovery_questions') {
            // Render discovery question library directly in the document page!
            content = `<h1>Interactive Discovery Question Library</h1><p>Select a category or search key phrases to extract qualifying questions.</p>`;
            renderWidget = () => renderQuestionsTool(docInteractiveSlot);
        }
    }

    // Check if we also want to embed the ROI calculator in sell section
    if (section === 'sell' && subKey === 'roi_framework') {
        renderWidget = () => renderRoiTool(docInteractiveSlot);
    }

    docMarkdownContent.innerHTML = content;

    // Handle embedded widget inside content grid
    if (renderWidget) {
        document.querySelector('.doc-body-wrapper').classList.add('with-widget');
        docInteractiveSlot.style.display = "block";
        renderWidget();
    } else {
        document.querySelector('.doc-body-wrapper').classList.remove('with-widget');
        docInteractiveSlot.style.display = "none";
    }

    // Attach copy-button listeners for marketing and code templates
    setupCopyListeners();
}

// HTML formatter for the tabbed campaign kits
function renderMarketingCampaignHTML(campaign) {
    let html = `<h1>Campaign Kit: ${campaign.name}</h1>
    <p class="lead">${campaign.strategy}</p>
    
    <div class="campaign-hub-layout">
        <div class="campaign-nav-list">
            <div class="campaign-nav-item active" data-pane="lp">Landing Page Copy</div>
            <div class="campaign-nav-item" data-pane="emails">Email Sequences</div>
            <div class="campaign-nav-item" data-pane="linkedin">LinkedIn Posts</div>
            <div class="campaign-nav-item" data-pane="whatsapp">WhatsApp Templates</div>
            <div class="campaign-nav-item" data-pane="webinar">Webinar Outline</div>
            <div class="campaign-nav-item" data-pane="outreach">Outreach Script</div>
        </div>
        
        <div class="campaign-content-view">
            <!-- Landing Page Pane -->
            <div class="campaign-pane active" id="pane-lp">
                <div class="template-card">
                    <div class="template-meta-header">LANDING PAGE HEADER & BENEFITS</div>
                    <div class="template-text-body">
<strong>HEADLINE:</strong> ${campaign.landing_page.headline}
<strong>SUBHEADLINE:</strong> ${campaign.landing_page.subheadline}

<strong>BENEFITS:</strong>
${campaign.landing_page.benefits.map(b => `- ${b}`).join('\n')}

<strong>CTA BUTTON:</strong> ${campaign.landing_page.cta}</div>
                    <button class="btn btn-secondary btn-copy-template" data-copy-src="lp"><i class="fa-solid fa-copy"></i> Copy LP Copy</button>
                </div>
            </div>

            <!-- Emails Pane -->
            <div class="campaign-pane" id="pane-emails">
                <div class="campaign-tabs">
                    ${campaign.email_sequence.map((em, idx) => `<button class="campaign-tab-btn ${idx === 0 ? 'active' : ''}" data-email-idx="${idx}">Email ${idx+1}</button>`).join('')}
                </div>
                ${campaign.email_sequence.map((em, idx) => `
                <div class="email-sub-pane template-card" id="email-sub-pane-${idx}" style="${idx === 0 ? 'display:block;' : 'display:none;'}">
                    <div class="template-meta-header">SUBJECT: ${em.subject}</div>
                    <div class="template-text-body">${em.body}</div>
                    <button class="btn btn-secondary btn-copy-template" data-copy-src="email-${idx}"><i class="fa-solid fa-copy"></i> Copy Email ${idx+1}</button>
                </div>
                `).join('')}
            </div>

            <!-- LinkedIn Pane -->
            <div class="campaign-pane" id="pane-linkedin">
                <div class="template-card">
                    <div class="template-meta-header">SOCIAL MEDIA COLLATERAL</div>
                    <div class="template-text-body">${campaign.linkedin_posts.map((post, idx) => `[Post ${idx+1}]\n${post}\n\n`).join('')}</div>
                    <button class="btn btn-secondary btn-copy-template" data-copy-src="li"><i class="fa-solid fa-copy"></i> Copy LinkedIn Posts</button>
                </div>
            </div>

            <!-- WhatsApp Pane -->
            <div class="campaign-pane" id="pane-whatsapp">
                <div class="template-card">
                    <div class="template-meta-header">WHATSAPP SHORT MESSAGING</div>
                    <div class="template-text-body">${campaign.whatsapp_messages.map((msg, idx) => `[Message ${idx+1}]\n${msg}\n\n`).join('')}</div>
                    <button class="btn btn-secondary btn-copy-template" data-copy-src="wa"><i class="fa-solid fa-copy"></i> Copy WhatsApp Templates</button>
                </div>
            </div>

            <!-- Webinar Pane -->
            <div class="campaign-pane" id="pane-webinar">
                <div class="template-card">
                    <div class="template-meta-header">WEBINAR STRUCTURE AND AGENDA</div>
                    <div class="template-text-body"><strong>TITLE:</strong> ${campaign.webinar_outline.title}

<strong>AGENDA OUTLINE:</strong>
${campaign.webinar_outline.agenda.map(a => `- ${a}`).join('\n')}</div>
                    <button class="btn btn-secondary btn-copy-template" data-copy-src="webinar"><i class="fa-solid fa-copy"></i> Copy Webinar Outline</button>
                </div>
            </div>

            <!-- Outreach Script Pane -->
            <div class="campaign-pane" id="pane-outreach">
                <div class="template-card">
                    <div class="template-meta-header">PARTNER OUTREACH SALES CALL SCRIPT</div>
                    <div class="template-text-body">${campaign.outreach_script}</div>
                    <button class="btn btn-secondary btn-copy-template" data-copy-src="outreach"><i class="fa-solid fa-copy"></i> Copy Call Script</button>
                </div>
            </div>
        </div>
    </div>`;

    return html;
}

// Setup listeners inside copyable blocks and tabs
function setupCopyListeners() {
    // Campaign nested navigation tabs click handlers
    const navItems = document.querySelectorAll('.campaign-nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            const targetPane = item.getAttribute('data-pane');
            document.querySelectorAll('.campaign-pane').forEach(p => p.classList.remove('active'));
            document.getElementById(`pane-${targetPane}`).classList.add('active');
        });
    });

    // Nested email buttons click handlers
    const emailTabs = document.querySelectorAll('.campaign-tab-btn');
    emailTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            emailTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const idx = tab.getAttribute('data-email-idx');
            document.querySelectorAll('.email-sub-pane').forEach(p => p.style.display = 'none');
            document.getElementById(`email-sub-pane-${idx}`).style.display = 'block';
        });
    });

    // Copy template button handlers
    const copyBtns = document.querySelectorAll('.btn-copy-template');
    copyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.template-card');
            const text = card.querySelector('.template-text-body').textContent;
            copyToClipboard(text, btn);
        });
    });
}

// ----------------------------------------------------
// INTERACTIVE TOOLS & RENDER ENGINES
// ----------------------------------------------------

// 1. Discovery Question Finder
function renderQuestionsTool(container) {
    container.innerHTML = `
    <div class="card questions-tool-layout">
        <h4><i class="fa-solid fa-clipboard-question"></i> Departmental Question Finder</h4>
        <div class="tool-filters">
            <select id="q-category-filter">
                <option value="all">All Categories</option>
                <option value="Finance">Finance</option>
                <option value="GST">GST</option>
                <option value="Compliance">Compliance</option>
                <option value="Operations">Operations</option>
                <option value="Reporting">Reporting</option>
                <option value="Payroll">Payroll</option>
                <option value="Automation">Automation</option>
            </select>
            <input type="text" id="q-search-filter" placeholder="Search key terms (e.g. VLOOKUP)...">
        </div>
        <div class="questions-count-status" id="q-status-count">Showing 210 questions</div>
        <div class="questions-grid-list" id="q-cards-list"></div>
    </div>`;

    const catSelect = document.getElementById('q-category-filter');
    const textSearch = document.getElementById('q-search-filter');
    const cardsList = document.getElementById('q-cards-list');
    const statusCount = document.getElementById('q-status-count');

    function filterQuestions() {
        const cat = catSelect.value;
        const text = textSearch.value.toLowerCase().trim();
        const questions = PARTNER_DATA.opportunities.discovery_questions;

        const filtered = questions.filter(q => {
            const matchesCat = (cat === 'all' || q.category === cat);
            const matchesText = (q.question.toLowerCase().includes(text) || q.id.toLowerCase().includes(text));
            return matchesCat && matchesText;
        });

        statusCount.textContent = `Showing ${filtered.length} of ${questions.length} questions`;
        
        cardsList.innerHTML = filtered.map(q => `
        <div class="question-row-card">
            <div class="q-card-text">
                <span class="q-meta-tag">${q.category}</span>
                <span class="q-meta-tag" style="background-color:rgba(0,0,0,0.1);color:var(--text-muted);">${q.id}</span>
                <p>${q.question}</p>
            </div>
            <button class="btn-copy-question" data-text="${q.question}" title="Copy Question"><i class="fa-solid fa-copy"></i></button>
        </div>`).join('');

        // Attach copy listeners
        cardsList.querySelectorAll('.btn-copy-question').forEach(btn => {
            btn.addEventListener('click', () => {
                const textVal = btn.getAttribute('data-text');
                copyToClipboard(textVal, btn);
            });
        });
    }

    catSelect.addEventListener('change', filterQuestions);
    textSearch.addEventListener('input', filterQuestions);

    // Initial render
    filterQuestions();
}

// 2. Objection Solver Battlecards
function renderObjectionsTool(container) {
    container.innerHTML = `
    <div class="card objections-tool-layout">
        <h4><i class="fa-solid fa-shield-heart"></i> Objection Solver</h4>
        <div class="tool-filters">
            <select id="o-category-filter">
                <option value="all">All Competitors / Issues</option>
                <option value="Tally">Tally</option>
                <option value="Zoho Books">Zoho Books</option>
                <option value="Busy/Marg">Busy/Marg</option>
                <option value="NetSuite/SAP">NetSuite/SAP</option>
                <option value="Cloud & Security">Cloud & Security</option>
                <option value="User Adoption">User Adoption</option>
                <option value="Pricing">Pricing</option>
                <option value="General">General</option>
            </select>
            <input type="text" id="o-search-filter" placeholder="Search objection keyword...">
        </div>
        <div class="questions-count-status" id="o-status-count">Showing 100 objections</div>
        <div class="objections-cards-list" id="o-cards-list"></div>
    </div>`;

    const catSelect = document.getElementById('o-category-filter');
    const textSearch = document.getElementById('o-search-filter');
    const cardsList = document.getElementById('o-cards-list');
    const statusCount = document.getElementById('o-status-count');

    function filterObjections() {
        const cat = catSelect.value;
        const text = textSearch.value.toLowerCase().trim();
        const objections = PARTNER_DATA.sell.objections;

        const filtered = objections.filter(o => {
            const matchesCat = (cat === 'all' || o.category === cat);
            const matchesText = (o.objection.toLowerCase().includes(text) || o.response.toLowerCase().includes(text));
            return matchesCat && matchesText;
        });

        statusCount.textContent = `Showing ${filtered.length} of ${objections.length} objections`;

        cardsList.innerHTML = filtered.map(o => `
        <div class="objection-detail-card">
            <div class="obj-card-header">
                <span class="q-meta-tag">${o.category}</span>
                <span class="q-meta-tag" style="background-color:rgba(0,0,0,0.1);color:var(--text-muted);">${o.id}</span>
            </div>
            <div class="obj-row-detail">
                <span class="obj-label">Customer Objection</span>
                <span class="obj-value" style="font-weight:600; color:var(--text-primary);">${o.objection}</span>
            </div>
            <div class="obj-row-detail">
                <span class="obj-label">Root Concern</span>
                <span class="obj-value">${o.concern}</span>
            </div>
            <div class="obj-row-detail response-box">
                <span class="obj-label" style="color:var(--accent-color);">Recommended Response Script</span>
                <span class="obj-value">${o.response}</span>
            </div>
            <div class="obj-row-detail">
                <span class="obj-label">Supporting Proof Point</span>
                <span class="obj-value" style="font-style:italic;">${o.proof}</span>
            </div>
            <button class="btn-copy-response" data-text="${o.response}"><i class="fa-solid fa-copy"></i> Copy Script</button>
        </div>`).join('');

        cardsList.querySelectorAll('.btn-copy-response').forEach(btn => {
            btn.addEventListener('click', () => {
                const textVal = btn.getAttribute('data-text');
                copyToClipboard(textVal, btn);
            });
        });
    }

    catSelect.addEventListener('change', filterObjections);
    textSearch.addEventListener('input', filterObjections);

    // Initial render
    filterObjections();
}

// 3. Interactive ROI Calculator
function renderRoiTool(container) {
    container.innerHTML = `
    <div class="card" style="grid-column: span 2;">
        <h4><i class="fa-solid fa-calculator"></i> Interactive ROI Calculator</h4>
        <p>Estimate the time, cost, and compliance savings that a typical mid-sized business realizes upon migrating to HostBooks.</p>
        <div class="roi-tool-layout" style="margin-top:20px;">
            <!-- Inputs Panel -->
            <div class="roi-inputs-panel">
                <h5 style="margin-bottom:10px; border-bottom: 1px solid var(--border-color); padding-bottom:8px;">Operational Inputs</h5>
                
                <!-- Input 1: Manual Accounting Hours -->
                <div class="roi-input-group">
                    <div style="display:flex; justify-content:space-between;">
                        <label for="roi-input-hours">Manual Bookkeeping/Reconciliation (Hours/Month)</label>
                        <span id="val-hours" style="font-weight:700; color:var(--accent-color);">80 hrs</span>
                    </div>
                    <input type="range" id="roi-range-hours" min="20" max="300" step="5" value="80">
                    <input type="number" id="roi-num-hours" min="20" max="300" value="80" style="display:none;">
                </div>

                <!-- Input 2: Compliance errors -->
                <div class="roi-input-group">
                    <div style="display:flex; justify-content:space-between;">
                        <label for="roi-input-fines">Yearly Compliance Penalties/Late Fees (INR)</label>
                        <span id="val-fines" style="font-weight:700; color:var(--accent-color);">₹25,000</span>
                    </div>
                    <input type="range" id="roi-range-fines" min="0" max="200000" step="5000" value="25000">
                </div>

                <!-- Input 3: Consolidation savings -->
                <div class="roi-input-group">
                    <div style="display:flex; justify-content:space-between;">
                        <label for="roi-input-lics">Monthly Disjointed Software Fees (INR)</label>
                        <span id="val-lics" style="font-weight:700; color:var(--accent-color);">₹8,000</span>
                    </div>
                    <input type="range" id="roi-range-lics" min="1000" max="50000" step="1000" value="8000">
                </div>

                <!-- Input 4: Labor Rate -->
                <div class="roi-input-group">
                    <div style="display:flex; justify-content:space-between;">
                        <label for="roi-input-rate">Average Accountant Labor Rate (INR / Hour)</label>
                        <span id="val-rate" style="font-weight:700; color:var(--accent-color);">₹250</span>
                    </div>
                    <input type="range" id="roi-range-rate" min="150" max="800" step="10" value="250">
                </div>
            </div>

            <!-- Results Panel -->
            <div class="roi-results-panel">
                <div>
                    <h5 style="margin-bottom:15px; border-bottom: 1px solid var(--border-color); padding-bottom:8px;">Calculated Annual Value</h5>
                    
                    <!-- Result 1: Time saved -->
                    <div class="roi-metric-row">
                        <div class="roi-metric-title">Time Savings</div>
                        <div class="roi-metric-value time-value" id="res-time-saved">68 Hours/Mo</div>
                        <div class="roi-metric-desc">Equivalent to reclaiming <strong id="res-fte-saved">0.4 FTEs</strong> yearly.</div>
                    </div>

                    <!-- Result 2: Financial Savings -->
                    <div class="roi-metric-row" style="margin-top:12px;">
                        <div class="roi-metric-title">Direct Compliance Savings</div>
                        <div class="roi-metric-value" id="res-fines-saved" style="color:var(--warning-color);">₹25,000 / Yr</div>
                        <div class="roi-metric-desc">Eliminated statutory interest, late filing fees, and billing errors.</div>
                    </div>

                    <!-- Result 3: Licensing consolidation -->
                    <div class="roi-metric-row" style="margin-top:12px;">
                        <div class="roi-metric-title">Software Cost Optimization</div>
                        <div class="roi-metric-value" id="res-lic-saved" style="color:var(--accent-color);">₹66,000 / Yr</div>
                        <div class="roi-metric-desc">Consolidated server, local database, and filing utility costs.</div>
                    </div>
                </div>

                <!-- Total Savings Summary -->
                <div class="roi-total-saving" style="background:var(--border-glow); padding:16px; border-radius:var(--border-radius-sm); border:1px solid var(--accent-color);">
                    <div class="roi-metric-title" style="color:var(--text-primary);">Total Projected Value</div>
                    <div class="roi-metric-value" id="res-total-savings" style="font-size:32px;">₹2,95,000 / Year</div>
                    <div class="roi-metric-desc" style="color:var(--text-primary); opacity:0.85;">Total time-equivalent savings + direct financial recoveries.</div>
                </div>
            </div>
        </div>
    </div>`;

    const rHours = document.getElementById('roi-range-hours');
    const rFines = document.getElementById('roi-range-fines');
    const rLics = document.getElementById('roi-range-lics');
    const rRate = document.getElementById('roi-range-rate');

    const vHours = document.getElementById('val-hours');
    const vFines = document.getElementById('val-fines');
    const vLics = document.getElementById('val-lics');
    const vRate = document.getElementById('val-rate');

    const resTime = document.getElementById('res-time-saved');
    const resFte = document.getElementById('res-fte-saved');
    const resFines = document.getElementById('res-fines-saved');
    const resLic = document.getElementById('res-lic-saved');
    const resTotal = document.getElementById('res-total-savings');

    function calculateROI() {
        const hours = parseInt(rHours.value);
        const fines = parseInt(rFines.value);
        const lics = parseInt(rLics.value);
        const rate = parseInt(rRate.value);

        // Update slider label readouts
        vHours.textContent = `${hours} hrs`;
        vFines.textContent = `₹${fines.toLocaleString('en-IN')}`;
        vLics.textContent = `₹${lics.toLocaleString('en-IN')}`;
        vRate.textContent = `₹${rate}`;

        // HostBooks automates bank reconciliation (saving ~85% time) and GSP GST downloads/ITC matching.
        // Let's assume average savings is 75% of manual bookkeeping hours
        const hoursSavedMonthly = Math.round(hours * 0.75);
        const hoursSavedYearly = hoursSavedMonthly * 12;
        
        // Time value in rupees
        const laborSavingsYearly = hoursSavedYearly * rate;

        // Fte equivalence
        const fteEquiv = (hoursSavedMonthly / 160).toFixed(1);

        // Software license savings:
        // By moving to HostBooks, they consolidate, saving e.g. 70% of current disjointed software fees
        // (Minus HostBooks average subscription of ~25,000 per year)
        const currentSoftwareSpendYearly = lics * 12;
        const hostbooksSubscriptionEst = 22000;
        const licSavingsYearly = Math.max(0, currentSoftwareSpendYearly - hostbooksSubscriptionEst);

        // Fines savings: 100% saved (compliance simplification guarantees)
        const finesSavingsYearly = fines;

        // Total savings
        const totalSavingsYearly = laborSavingsYearly + finesSavingsYearly + licSavingsYearly;

        // Output results
        resTime.textContent = `${hoursSavedMonthly} Hours/Mo`;
        resFte.textContent = `${fteEquiv} FTE${fteEquiv === '1.0' ? '' : 's'}`;
        resFines.textContent = `₹${finesSavingsYearly.toLocaleString('en-IN')} / Yr`;
        resLic.textContent = `₹${licSavingsYearly.toLocaleString('en-IN')} / Yr`;
        resTotal.textContent = `₹${totalSavingsYearly.toLocaleString('en-IN')} / Year`;
    }

    [rHours, rFines, rLics, rRate].forEach(s => s.addEventListener('input', calculateROI));

    // Initial run
    calculateROI();
}

// ----------------------------------------------------
// QUICK UTILITIES MODAL POPUP
// ----------------------------------------------------
function setupQuickTools() {
    const trigger = document.getElementById('btn-quick-tools');
    
    // Toggle dropdown
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        toolsDropdownMenu.classList.toggle('active');
    });

    // Close dropdown on click outside
    document.addEventListener('click', () => {
        toolsDropdownMenu.classList.remove('active');
    });

    // Handle dropdown items click
    const menuLinks = toolsDropdownMenu.querySelectorAll('a');
    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tool = link.getAttribute('data-tool');
            openToolModal(tool);
        });
    });

    // Close modal handlers
    document.getElementById('btn-close-modal').addEventListener('click', closeModal);
    toolsModal.addEventListener('click', (e) => {
        if (e.target === toolsModal) closeModal();
    });
}

function openToolModal(toolType) {
    toolsDropdownMenu.classList.remove('active');
    toolsModal.style.display = "flex";
    
    if (toolType === 'roi') {
        modalTitle.innerHTML = `<i class="fa-solid fa-calculator"></i> ROI Calculator`;
        renderRoiTool(modalBodyContent);
    } else if (toolType === 'questions') {
        modalTitle.innerHTML = `<i class="fa-solid fa-clipboard-question"></i> Departmental Question Finder`;
        renderQuestionsTool(modalBodyContent);
    } else if (toolType === 'objections') {
        modalTitle.innerHTML = `<i class="fa-solid fa-shield-heart"></i> Objection Solver`;
        renderObjectionsTool(modalBodyContent);
    }
}

function closeModal() {
    toolsModal.style.display = "none";
    modalBodyContent.innerHTML = "";
}

// ----------------------------------------------------
// GLOBAL SEARCH ENGINE
// ----------------------------------------------------
function setupSearch() {
    // Focus search on '/' key press
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== globalSearchInput) {
            e.preventDefault();
            globalSearchInput.focus();
        }
    });

    // Search matches logic
    globalSearchInput.addEventListener('input', () => {
        const query = globalSearchInput.value.toLowerCase().trim();
        if (!query) {
            searchResultsBox.style.display = "none";
            return;
        }

        const matches = [];

        // 1. Search in questions list
        const questions = PARTNER_DATA.opportunities.discovery_questions;
        questions.forEach(q => {
            if (q.question.toLowerCase().includes(query) || q.id.toLowerCase().includes(query)) {
                matches.push({
                    type: 'question',
                    title: `${q.id}: ${q.question}`,
                    cat: `Opportunities (${q.category})`,
                    action: () => {
                        navigateTo('opportunities', 'discovery_questions');
                        // Highlight the target question once UI is loaded
                        setTimeout(() => {
                            const searchBox = document.getElementById('q-search-filter');
                            if (searchBox) {
                                searchBox.value = q.id;
                                searchBox.dispatchEvent(new Event('input'));
                            }
                        }, 200);
                    }
                });
            }
        });

        // 2. Search in objections list
        const objections = PARTNER_DATA.sell.objections;
        objections.forEach(o => {
            if (o.objection.toLowerCase().includes(query) || o.response.toLowerCase().includes(query)) {
                matches.push({
                    type: 'objection',
                    title: `${o.id}: ${o.objection}`,
                    cat: `Objections (${o.category})`,
                    action: () => {
                        navigateTo('sell', 'objections');
                        setTimeout(() => {
                            const searchBox = document.getElementById('o-search-filter');
                            if (searchBox) {
                                searchBox.value = o.id;
                                searchBox.dispatchEvent(new Event('input'));
                            }
                        }, 200);
                    }
                });
            }
        });

        // 3. Search in campaigns list
        const campaigns = PARTNER_DATA.marketing;
        campaigns.forEach(c => {
            if (c.name.toLowerCase().includes(query) || c.strategy.toLowerCase().includes(query)) {
                matches.push({
                    type: 'campaign',
                    title: c.name,
                    cat: 'Marketing Toolkit',
                    action: () => navigateTo('marketing', c.id)
                });
            }
        });

        // Show matches in dropdown
        if (matches.length > 0) {
            searchResultsBox.style.display = "block";
            // Cap results at 8
            const sliced = matches.slice(0, 8);
            searchResultsBox.innerHTML = sliced.map((m, idx) => `
            <div class="search-res-item" data-idx="${idx}">
                <div class="search-res-cat">${m.cat}</div>
                <div class="search-res-title">${m.title}</div>
            </div>`).join('');

            // Add click handlers to results
            searchResultsBox.querySelectorAll('.search-res-item').forEach(item => {
                item.addEventListener('click', () => {
                    const idx = item.getAttribute('data-idx');
                    sliced[idx].action();
                    globalSearchInput.value = "";
                    searchResultsBox.style.display = "none";
                });
            });
        } else {
            searchResultsBox.style.display = "block";
            searchResultsBox.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px;">No resources found.</div>`;
        }
    });

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
        if (!globalSearchInput.contains(e.target) && !searchResultsBox.contains(e.target)) {
            searchResultsBox.style.display = "none";
        }
    });
}

// ----------------------------------------------------
// DASHBOARD NAVIGATION INTERACTION
// ----------------------------------------------------
function setupDashboardClicks() {
    // Interactive Widget Cards on Dashboard
    document.getElementById('card-tool-questions').addEventListener('click', () => {
        navigateTo('opportunities', 'discovery_questions');
    });

    document.getElementById('card-tool-objections').addEventListener('click', () => {
        navigateTo('sell', 'objections');
    });

    document.getElementById('card-tool-roi').addEventListener('click', () => {
        navigateTo('sell', 'roi_framework');
    });

    document.getElementById('card-tool-campaigns').addEventListener('click', () => {
        navigateTo('marketing');
    });

    // Enablement track rows click
    document.querySelectorAll('.track-row').forEach(row => {
        row.addEventListener('click', () => {
            const target = row.getAttribute('data-target');
            navigateTo(target);
        });
    });

    // Onboarding links click
    document.querySelectorAll('.link-list a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-target');
            const sub = link.getAttribute('data-sub');
            navigateTo(target, sub);
        });
    });
}
