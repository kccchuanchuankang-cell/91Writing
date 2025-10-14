/**
 * 就要创作 - 主应用脚本
 * 整合新UI布局和完整AI助手功能
 */

// ==================== 全局状态 ====================
let currentProject = null;
let currentChapter = null;
let projects = [];
let projectFolders = []; // 动态文件夹列表
let rootFiles = []; // 根目录文件列表
let folderStates = {}; // 记录每个文件夹的展开/收起状态
let openedTabs = []; // 记录打开的文件标签页
let chapters = [];
let isGenerating = false;
let currentReader = null;

// AI助手推理过程管理
let currentReasoningSteps = [];
let currentStepIndex = 0;
let currentStepContent = '';

// 引用文件
let referencedFiles = [];

// @ 下拉菜单状态
let atDropdownVisible = false;
let atDropdownFolders = [];
let atDropdownItems = [];
let atDropdownSelectedIndex = -1;
let atStartPosition = -1;

// 右键菜单状态
let contextMenuTarget = null;
let inputDialogCallback = null;

// ==================== DOM 元素 ====================
// 侧边栏控制
const projectSidebar = document.getElementById('projectSidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const refreshProjectBtn = document.getElementById('refreshProjectBtn');

// 项目和编辑器
const projectList = document.getElementById('projectList');
const projectTitle = document.getElementById('projectTitle');
const outlineContent = document.getElementById('outlineContent');
const chapterTabs = document.getElementById('chapterTabs');
const chapterTitleInput = document.getElementById('chapterTitleInput');
const chapterContentEditor = document.getElementById('chapterContentEditor');

// 内容统计
const wordCount = document.getElementById('wordCount');
const paragraphCount = document.getElementById('paragraphCount');
const readingTime = document.getElementById('readingTime');

// AI助手
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const loadingIndicator = document.getElementById('loadingIndicator');

// 可拖动分隔条
const outlineResizer = document.getElementById('outlineResizer');
const outlinePanel = document.getElementById('outlinePanel');
const resizer = document.getElementById('resizer');
const aiAssistantPanel = document.getElementById('aiAssistantPanel');

// 按钮
const newProjectBtn = document.getElementById('newProjectBtn');
const saveChapterBtn = document.getElementById('saveChapterBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const settingsBtn = document.getElementById('settingsBtn');

// 编辑器缺省页
const editorEmptyState = document.getElementById('editorEmptyState');

// Diff 预览相关元素
const diffPreview = document.getElementById('diffPreview');
const diffFileName = document.getElementById('diffFileName');
const diffRevisionNote = document.getElementById('diffRevisionNote');
const diffRevisionNoteText = document.getElementById('diffRevisionNoteText');
const diffContent = document.getElementById('diffContent');
const acceptDiffBtn = document.getElementById('acceptDiffBtn');
const rejectDiffBtn = document.getElementById('rejectDiffBtn');

// Diff 相关状态
let currentDiff = null;

// 文件引用
const fileReferenceArea = document.getElementById('fileReferenceArea');
const referenceList = document.getElementById('referenceList');
const clearReferencesBtn = document.getElementById('clearReferencesBtn');
const atFileBtn = document.getElementById('atFileBtn');
const uploadFileBtn = document.getElementById('uploadFileBtn');
const fileUploadInput = document.getElementById('fileUploadInput');
const atFileDropdown = document.getElementById('atFileDropdown');
const atFileList = document.getElementById('atFileList');
const atFileSearchInput = document.getElementById('atFileSearchInput');

// 模态框
const newProjectModal = document.getElementById('newProjectModal');
const newProjectName = document.getElementById('newProjectName');
const createProjectBtn = document.getElementById('createProjectBtn');
const cancelProjectBtn = document.getElementById('cancelProjectBtn');

const settingsModal = document.getElementById('settingsModal');
const closeSettingsModal = document.getElementById('closeSettingsModal');
const systemPromptEditor = document.getElementById('systemPromptEditor');
const saveSystemPromptBtn = document.getElementById('saveSystemPromptBtn');

// API配置相关元素
const apiKeyInput = document.getElementById('apiKey');
const apiBaseUrlInput = document.getElementById('apiBaseUrl');
const modelNameInput = document.getElementById('modelName');
const temperatureInput = document.getElementById('temperature');
const maxIterationsInput = document.getElementById('maxIterations');
const saveApiConfigBtn = document.getElementById('saveApiConfigBtn');
const testApiBtn = document.getElementById('testApiBtn');
const toggleApiKeyBtn = document.getElementById('toggleApiKeyBtn');

// 右键菜单
const contextMenu = document.getElementById('contextMenu');
const inputDialog = document.getElementById('inputDialog');
const inputDialogTitle = document.getElementById('inputDialogTitle');
const inputDialogValue = document.getElementById('inputDialogValue');
const confirmInputBtn = document.getElementById('confirmInputBtn');
const cancelInputBtn = document.getElementById('cancelInputBtn');
const closeInputDialog = document.getElementById('closeInputDialog');

// ==================== 初始化 ====================
async function init() {
    setupEventListeners();
    await loadProjects();
    
    // 如果没有选中项目，隐藏资源管理面板
    if (!currentProject && outlinePanel) {
        outlinePanel.classList.add('hidden');
    }
    
    // 初始化时显示缺省页
    updateEditorEmptyState();
}

// ==================== 事件监听 ====================
function setupEventListeners() {
    // 侧边栏折叠
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            projectSidebar.classList.toggle('collapsed');
            // 重新渲染项目列表以更新显示
            renderProjects();
        });
    }
    
    // 🔥 手动刷新项目文件
    if (refreshProjectBtn) {
        refreshProjectBtn.addEventListener('click', async () => {
            if (!currentProject) return;
            
            // 🔥 如果正在推理，只刷新文件列表，不刷新对话历史
            if (isGenerating) {
                console.log('⚠️ AI 正在推理中，只刷新文件列表，不影响对话');
            }
            
            // 添加旋转动画
            refreshProjectBtn.classList.add('refreshing');
            
            try {
                console.log('🔄 手动刷新项目文件...');
                
                // 🔥 只刷新文件列表，不刷新对话历史（避免影响AI推理）
                await loadProjectFolders(true);  // 只刷新文件列表
                
                console.log('✅ 项目文件已刷新');
            } catch (error) {
                console.error('刷新失败:', error);
                alert('刷新失败，请重试');
            } finally {
                // 移除旋转动画
                refreshProjectBtn.classList.remove('refreshing');
            }
        });
    }
    
    // 项目相关
    newProjectBtn.addEventListener('click', () => showModal(newProjectModal));
    cancelProjectBtn.addEventListener('click', () => hideModal(newProjectModal));
    createProjectBtn.addEventListener('click', createProject);
    
    // 编辑器相关
    saveChapterBtn.addEventListener('click', saveCurrentChapter);
    
    // 内容统计 - 实时更新
    chapterContentEditor.addEventListener('input', updateContentStats);
    
    // 全局快捷键
    document.addEventListener('keydown', handleGlobalKeydown);
    
    // Diff 预览相关
    acceptDiffBtn.addEventListener('click', acceptDiff);
    rejectDiffBtn.addEventListener('click', rejectDiff);
    
    // AI助手相关
    sendBtn.addEventListener('click', () => {
        if (isGenerating) {
            stopGenerating();
        } else {
            sendMessage();
        }
    });
    clearHistoryBtn.addEventListener('click', clearHistory);
    chatInput.addEventListener('keydown', handleChatInputKeydown);
    chatInput.addEventListener('input', handleChatInputChange);
    
    // 文件引用
    clearReferencesBtn.addEventListener('click', clearAllReferences);
    atFileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentProject) {
            alert('⚠️ 请先选择一个项目');
            return;
        }
        if (atDropdownVisible) {
            closeAtDropdown();
        } else {
            showAtDropdown();
            setTimeout(() => atFileSearchInput.focus(), 100);
        }
    });
    uploadFileBtn.addEventListener('click', () => fileUploadInput.click());
    fileUploadInput.addEventListener('change', handleFileUpload);
    atFileSearchInput.addEventListener('input', handleAtSearchInput);
    
    // 点击外部关闭下拉菜单
    document.addEventListener('click', (e) => {
        if (!atFileDropdown.contains(e.target) && e.target !== chatInput && e.target !== atFileBtn) {
            closeAtDropdown();
        }
    });
    
    // 设置按钮
    settingsBtn.addEventListener('click', openSettings);
    closeSettingsModal.addEventListener('click', () => hideModal(settingsModal));
    saveSystemPromptBtn.addEventListener('click', saveSystemPrompt);
    saveApiConfigBtn.addEventListener('click', saveApiConfig);
    testApiBtn.addEventListener('click', testApiConnection);
    toggleApiKeyBtn.addEventListener('click', toggleApiKeyVisibility);
    
    // API Key输入框变化时更新realApiKey
    apiKeyInput.addEventListener('input', (e) => {
        const value = e.target.value;
        // 如果不是占位符，就保存真实值
        if (value !== '••••••••••••••••') {
            realApiKey = value;
        }
    });
    
    // Tab切换
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const targetTab = e.target.dataset.tab;
            switchSettingsTab(targetTab);
        });
    });
    
    // 右键菜单 - 点击外部关闭
    document.addEventListener('click', (e) => {
        if (contextMenu && !contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });
    
    // 右键菜单项点击事件 - 使用事件委托
    if (contextMenu) {
        contextMenu.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 查找最近的菜单项元素
            const menuItem = e.target.closest('.context-menu-item');
            if (menuItem && menuItem.dataset.action) {
                console.log('菜单项被点击:', menuItem.dataset.action);
                
                // 创建一个事件对象传递给处理函数
                const event = {
                    currentTarget: menuItem,
                    preventDefault: () => {},
                    stopPropagation: () => {}
                };
                handleContextMenuAction(event);
            }
        });
        
        console.log('右键菜单事件监听器已绑定（使用事件委托）');
    }
    
    // 输入对话框
    closeInputDialog.addEventListener('click', () => hideModal(inputDialog));
    cancelInputBtn.addEventListener('click', () => hideModal(inputDialog));
    confirmInputBtn.addEventListener('click', handleInputConfirm);
    inputDialogValue.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleInputConfirm();
    });
    
    // 项目筛选
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterProjects(btn.dataset.filter);
        });
    });
    
    // 项目搜索
    const projectSearch = document.getElementById('projectSearch');
    if (projectSearch) {
        projectSearch.addEventListener('input', (e) => {
            searchProjects(e.target.value);
        });
    }
    
    // 可拖动分隔条 - 文件管理面板
    if (outlineResizer && outlinePanel) {
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;
        
        outlineResizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = outlinePanel.offsetWidth;
            outlineResizer.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const deltaX = e.clientX - startX;
            const newWidth = startWidth + deltaX;
            
            // 限制宽度范围
            const minWidth = parseInt(getComputedStyle(outlinePanel).minWidth) || 200;
            const maxWidth = parseInt(getComputedStyle(outlinePanel).maxWidth) || 600;
            
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                outlinePanel.style.width = `${newWidth}px`;
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                outlineResizer.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }
    
    // 可拖动分隔条 - AI助手面板
    if (resizer && aiAssistantPanel) {
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;
        
        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = aiAssistantPanel.offsetWidth;
            resizer.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const deltaX = startX - e.clientX;
            const newWidth = startWidth + deltaX;
            
            // 限制宽度范围
            const minWidth = parseInt(getComputedStyle(aiAssistantPanel).minWidth) || 300;
            const maxWidth = parseInt(getComputedStyle(aiAssistantPanel).maxWidth) || 800;
            
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                aiAssistantPanel.style.width = `${newWidth}px`;
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizer.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }
}

// ==================== 全局快捷键 ====================
function handleGlobalKeydown(e) {
    // Ctrl+S 或 Cmd+S 保存
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (currentChapter && currentProject) {
            saveCurrentChapter();
        }
    }
}

// ==================== Diff 预览功能 ====================
/**
 * 显示文件修改的 Diff 预览
 */
function showFileDiff(diffData) {
    const { type, filename, oldContent, newContent, revisionNote } = diffData;
    
    // 保存当前diff数据
    currentDiff = diffData;
    
    // 更新文件名显示
    diffFileName.textContent = `${type}/${filename}`;
    
    // 显示修改说明
    if (revisionNote && revisionNote.trim()) {
        diffRevisionNoteText.textContent = revisionNote;
        diffRevisionNote.style.display = 'block';
    } else {
        diffRevisionNote.style.display = 'none';
    }
    
    // 生成unified diff格式
    const unifiedDiff = createUnifiedDiff(filename, oldContent, newContent);
    
    // 使用 diff2html 渲染
    try {
        const diff2htmlUi = new Diff2HtmlUI(diffContent, unifiedDiff, {
            drawFileList: false,
            matching: 'lines',
            outputFormat: 'side-by-side',
            synchronisedScroll: true
        });
        diff2htmlUi.draw();
    } catch (error) {
        console.error('Diff渲染失败:', error);
        // 降级显示：简单的文本对比
        diffContent.innerHTML = `
            <div style="padding: 20px;">
                <h3>原内容：</h3>
                <pre style="background: #fff2f0; padding: 15px; border-radius: 4px; white-space: pre-wrap;">${escapeHtml(oldContent)}</pre>
                <h3 style="margin-top: 20px;">新内容：</h3>
                <pre style="background: #f0f9ff; padding: 15px; border-radius: 4px; white-space: pre-wrap;">${escapeHtml(newContent)}</pre>
            </div>
        `;
    }
    
    // 显示diff预览区域
    diffPreview.style.display = 'flex';
    
    console.log('📝 显示 Diff 预览:', type, filename);
}

/**
 * 创建 Unified Diff 格式
 */
function createUnifiedDiff(filename, oldContent, newContent) {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    let diff = `--- a/${filename}\n`;
    diff += `+++ b/${filename}\n`;
    diff += `@@ -1,${oldLines.length} +1,${newLines.length} @@\n`;
    
    // 简单的行级diff
    const maxLines = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLines; i++) {
        const oldLine = oldLines[i] || '';
        const newLine = newLines[i] || '';
        
        if (oldLine === newLine) {
            diff += ` ${oldLine}\n`;
        } else {
            if (oldLine) diff += `-${oldLine}\n`;
            if (newLine) diff += `+${newLine}\n`;
        }
    }
    
    return diff;
}

/**
 * 接受 Diff 修改
 */
async function acceptDiff() {
    if (!currentDiff || !currentProject) return;
    
    const { type, filename, newContent } = currentDiff;
    
    try {
        acceptDiffBtn.disabled = true;
        acceptDiffBtn.textContent = '保存中...';
        
        // 保存新内容到文件
        const saveUrl = `/api/projects/${currentProject}/files/${type}/${filename}`;
        const response = await fetch(saveUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: newContent })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 关闭diff预览
            diffPreview.style.display = 'none';
            currentDiff = null;
            
            // 显示成功消息
            addMessage('assistant', '✅ 修改已接受并保存');
            
            // 🔥 刷新文件列表（清除缓存）
            await loadProjectFolders(true);
            
            // 如果修改的是当前打开的文件，重新加载
            if (currentChapter && currentChapter.filename === filename && currentChapter.folderName === type) {
                await editFile(type, { filename, title: filename.replace('.md', '') });
            }
        } else {
            alert('❌ 保存失败: ' + data.error);
        }
    } catch (error) {
        console.error('接受修改失败:', error);
        alert('❌ 保存失败: ' + error.message);
    } finally {
        acceptDiffBtn.disabled = false;
        acceptDiffBtn.textContent = '✓ 接受修改';
    }
}

/**
 * 拒绝 Diff 修改
 */
function rejectDiff() {
    if (!currentDiff) return;
    
    // 关闭diff预览
    diffPreview.style.display = 'none';
    currentDiff = null;
    
    // 显示拒绝消息
    addMessage('assistant', '❌ 修改已拒绝，文件保持不变');
    
    console.log('❌ 用户拒绝了修改');
}

/**
 * HTML转义
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== 项目管理 ====================
async function loadProjects() {
    try {
        const response = await fetch('/api/projects');
        const data = await response.json();
        
        if (data.success) {
            projects = data.projects.map(p => ({
                name: p.name,
                displayName: p.projectName || p.name,
                lastModified: new Date(p.lastModified || Date.now()),
                category: 'progress'
            }));
            renderProjects();
        }
    } catch (error) {
        console.error('加载项目失败:', error);
    }
}

function renderProjects(filteredProjects = projects) {
    if (!projectList) return;
    
    projectList.innerHTML = '';
    
    if (filteredProjects.length === 0) {
        projectList.innerHTML = '<div style="text-align: center; padding: 20px; color: #999999;">暂无项目</div>';
        return;
    }
    
    const isCollapsed = projectSidebar && projectSidebar.classList.contains('collapsed');
    
    filteredProjects.forEach(project => {
        const item = document.createElement('div');
        item.className = 'project-item';
        if (currentProject === project.name) {
            item.classList.add('active');
        }
        
        // 收起时只显示第一个字
        const displayName = isCollapsed ? project.displayName.charAt(0) : project.displayName;
        
        item.innerHTML = `
            <div class="project-content">
                <div class="project-name">${displayName}</div>
                <div class="project-meta">
                    <span>最后更新: ${formatTime(project.lastModified)}</span>
                </div>
            </div>
            ${!isCollapsed ? `<button class="project-delete-btn" title="删除项目" data-project="${project.name}">🗑️</button>` : ''}
        `;
        
        // 添加提示信息
        if (isCollapsed) {
            item.title = project.displayName;
        }
        
        // 点击项目内容区域选择项目
        const projectContent = item.querySelector('.project-content');
        projectContent.addEventListener('click', () => selectProject(project.name));
        
        // 删除按钮事件
        const deleteBtn = item.querySelector('.project-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止触发项目选择
                deleteProject(project.name, project.displayName);
            });
        }
        
        projectList.appendChild(item);
    });
}

async function selectProject(projectName) {
    // 🔥 如果正在生成，阻止切换项目
    if (isGenerating) {
        console.log('⚠️ AI 正在推理中，无法切换项目');
        alert('⚠️ AI 正在工作中，请等待完成或先终止当前任务');
        return;
    }
    
    currentProject = projectName;
    
    document.querySelectorAll('.project-item').forEach((item, index) => {
        item.classList.toggle('active', projects[index]?.name === projectName);
    });
    
    // 显示资源管理面板
    if (outlinePanel) {
        outlinePanel.classList.remove('hidden');
    }
    
    await loadProjectData();
}

/**
 * 禁用项目切换（AI 推理过程中）
 */
function disableProjectSwitching() {
    const projectItems = document.querySelectorAll('.project-item');
    projectItems.forEach(item => {
        item.style.pointerEvents = 'none';
        item.style.opacity = '0.5';
        item.style.cursor = 'not-allowed';
        item.title = '⚠️ AI 正在工作中，无法切换项目';
    });
    
    // 禁用新建项目按钮
    const newProjectBtn = document.getElementById('newProjectBtn');
    if (newProjectBtn) {
        newProjectBtn.disabled = true;
        newProjectBtn.style.opacity = '0.5';
        newProjectBtn.style.cursor = 'not-allowed';
    }
    
    // 🔥 禁用侧边栏折叠按钮
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.disabled = true;
        sidebarToggle.style.opacity = '0.5';
        sidebarToggle.style.cursor = 'not-allowed';
        sidebarToggle.title = '⚠️ AI 正在工作中';
    }
    
    console.log('🔒 已禁用项目切换');
}

/**
 * 启用项目切换
 */
function enableProjectSwitching() {
    const projectItems = document.querySelectorAll('.project-item');
    projectItems.forEach(item => {
        item.style.pointerEvents = '';
        item.style.opacity = '';
        item.style.cursor = '';
        item.title = '';
    });
    
    // 启用新建项目按钮
    const newProjectBtn = document.getElementById('newProjectBtn');
    if (newProjectBtn) {
        newProjectBtn.disabled = false;
        newProjectBtn.style.opacity = '';
        newProjectBtn.style.cursor = '';
    }
    
    // 🔥 启用侧边栏折叠按钮
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.disabled = false;
        sidebarToggle.style.opacity = '';
        sidebarToggle.style.cursor = '';
        sidebarToggle.title = '收起/展开侧边栏';
    }
    
    console.log('🔓 已启用项目切换');
}

async function loadProjectData(clearCache = false) {
    if (!currentProject) return;
    
    try {
        const project = projects.find(p => p.name === currentProject);
        projectTitle.textContent = project?.displayName || currentProject;
        
        // 🔥 传递 clearCache 参数，强制刷新文件列表
        await loadProjectFolders(clearCache);
        await loadConversationHistory();
        // 加载项目数据后更新缺省页状态
        updateEditorEmptyState();
    } catch (error) {
        console.error('加载项目数据失败:', error);
    }
}

async function deleteProject(projectName, displayName) {
    if (!confirm(`⚠️ 确定要删除项目"${displayName}"吗？\n\n删除后将无法恢复，包括所有章节内容和对话历史！`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/projects/${projectName}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ 项目已删除');
            
            // 如果删除的是当前项目，清空界面
            if (currentProject === projectName) {
                currentProject = null;
                currentChapter = null;
                chapterTitleInput.value = '';
                chapterContentEditor.value = '';
                projectTitle.textContent = '未选择项目';
                outlineContent.innerHTML = '';
                chatMessages.innerHTML = '';
                openedTabs = [];
                renderChapterTabs();
            }
            
            // 重新加载项目列表
            await loadProjects();
            
            // 如果还有其他项目，自动选择第一个
            if (projects.length > 0 && !currentProject) {
                await selectProject(projects[0].name);
            } else if (projects.length === 0) {
                // 如果没有项目了，隐藏资源管理面板
                if (outlinePanel) {
                    outlinePanel.classList.add('hidden');
                }
            }
        } else {
            alert('❌ 删除失败: ' + (data.error || '未知错误'));
        }
    } catch (error) {
        console.error('删除项目失败:', error);
        alert('❌ 删除失败: ' + error.message);
    }
}

async function createProject() {
    const name = newProjectName.value.trim();
    if (!name) {
        alert('请输入项目名称');
        return;
    }
    
    try {
        const response = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        
        const data = await response.json();
        
        if (data.success) {
            hideModal(newProjectModal);
            newProjectName.value = '';
            await loadProjects();
            await selectProject(name);
        } else {
            alert('创建失败: ' + data.error);
        }
    } catch (error) {
        console.error('创建项目失败:', error);
    }
}

function filterProjects(filter) {
    if (filter === 'all') {
        renderProjects(projects);
    } else {
        const filtered = projects.filter(p => p.category === filter);
        renderProjects(filtered);
    }
}

function searchProjects(keyword) {
    if (!keyword) {
        renderProjects(projects);
            return;
        }
        
    const filtered = projects.filter(p => 
        p.displayName.toLowerCase().includes(keyword.toLowerCase())
    );
    renderProjects(filtered);
}

// ==================== 文件夹和文件管理 ====================

/**
 * 加载项目的所有文件夹和根目录文件
 */
async function loadProjectFolders(clearCache = false) {
    try {
        const response = await fetch(`/api/projects/${currentProject}/folders`);
        const data = await response.json();
        
        if (data.success) {
            rootFiles = data.rootFiles || [];
            projectFolders = data.folders || [];
            
            // 🔥 如果需要清除缓存，清空所有已加载的文件列表
            if (clearCache) {
                Object.keys(folderStates).forEach(folderName => {
                    if (folderStates[folderName]) {
                        folderStates[folderName].files = [];
                    }
                });
            }
            
            // 初始化文件夹状态（默认展开第一个文件夹）
            projectFolders.forEach((folder, index) => {
                if (folderStates[folder.name] === undefined) {
                    folderStates[folder.name] = {
                        expanded: index === 0, // 第一个文件夹默认展开
                        files: []
                    };
                }
            });
            
            renderFolderStructure();
            
            // 🔥 重新加载所有已展开文件夹的文件列表
            const expandedFolders = projectFolders.filter(f => folderStates[f.name]?.expanded);
            for (const folder of expandedFolders) {
                await loadFolderFiles(folder.name);
            }
        }
    } catch (error) {
        console.error('加载文件夹失败:', error);
        rootFiles = [];
        projectFolders = [];
        renderFolderStructure();
    }
}

/**
 * 渲染文件夹结构（树形结构）
 */
function renderFolderStructure() {
    if (!outlineContent) return;
    
    outlineContent.innerHTML = '';
    
    if (rootFiles.length === 0 && projectFolders.length === 0) {
        outlineContent.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: #999;">暂无内容</div>';
        return;
    }
    
    // 创建项目根节点 - VSCode 风格
    const project = projects.find(p => p.name === currentProject);
    const projectRoot = document.createElement('div');
    projectRoot.className = 'tree-root';
    projectRoot.innerHTML = `
        <div class="tree-item tree-root-item" data-depth="0">
            <span class="tree-toggle expanded"></span>
            <span class="tree-icon">📁</span>
            <span class="tree-label">${project?.displayName || currentProject}</span>
        </div>
        <div class="tree-children expanded"></div>
    `;
    
    // 给项目根添加右键菜单
    const rootItem = projectRoot.querySelector('.tree-root-item');
    rootItem.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e, { type: 'root', folderName: null });
    });
    
    // 项目根节点作为拖放目标（移动文件到根目录） - VSCode 风格
    rootItem.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        rootItem.style.backgroundColor = 'rgba(0, 120, 212, 0.15)';
    });
    
    rootItem.addEventListener('dragleave', (e) => {
        e.stopPropagation();
        rootItem.style.backgroundColor = '';
    });
    
    rootItem.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        rootItem.style.backgroundColor = '';
        
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.type === 'file') {
                // 如果文件已经在根目录，不处理
                if (!data.folderName) {
                    alert('文件已在根目录中');
                    return;
                }
                
                // 移动到根目录（targetFolder 为 null）
                await moveFile(data.path, null);
            }
        } catch (error) {
            console.error('拖放失败:', error);
        }
    });
    
    outlineContent.appendChild(projectRoot);
    
    const childrenContainer = projectRoot.querySelector('.tree-children');
    
    // 先渲染文件夹
    projectFolders.forEach(folder => {
        const folderNode = createFolderNode(folder, 1);
        childrenContainer.appendChild(folderNode);
    });
    
    // 根目录文件放在最后
    if (rootFiles.length > 0) {
        rootFiles.forEach(file => {
            const fileNode = createFileNode(file, null, 1);
            childrenContainer.appendChild(fileNode);
        });
    }
}

/**
 * 创建文件夹节点
 */
function createFolderNode(folder, level) {
    const isExpanded = folderStates[folder.name]?.expanded || false;
    const files = folderStates[folder.name]?.files || [];
    
    const folderDiv = document.createElement('div');
    folderDiv.className = 'tree-node';
    
    // VSCode 风格：使用 data-depth 属性
    folderDiv.innerHTML = `
        <div class="tree-item folder" data-folder="${folder.name}" data-depth="${level}">
            <span class="tree-toggle ${isExpanded ? 'expanded' : ''}"></span>
            <span class="tree-icon">📁</span>
            <span class="tree-label">${folder.name}</span>
            <span class="tree-count">${folder.fileCount}</span>
        </div>
        <div class="tree-children ${isExpanded ? 'expanded' : ''}"></div>
    `;
    
    const header = folderDiv.querySelector('.tree-item');
    const childrenContainer = folderDiv.querySelector('.tree-children');
    
    // 点击切换展开/收起
    header.addEventListener('click', async (e) => {
        e.stopPropagation();
        await toggleFolder(folder.name);
    });
    
    // 右键菜单
    header.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e, { 
            type: 'folder', 
            folderName: folder.name,
            path: folder.name
        });
    });
    
    // 拖放目标事件（VSCode 风格：简化反馈）
    header.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        header.style.backgroundColor = 'rgba(0, 120, 212, 0.15)';
    });
    
    header.addEventListener('dragleave', (e) => {
        e.stopPropagation();
        header.style.backgroundColor = '';
    });
    
    header.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        header.style.backgroundColor = '';
        
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.type === 'file') {
                // 不能移动到同一个文件夹
                if (data.folderName === folder.name) {
                    alert('文件已在当前文件夹中');
                    return;
                }
                
                await moveFile(data.path, folder.name);
            }
        } catch (error) {
            console.error('拖放失败:', error);
        }
    });
    
    // 渲染子文件
    if (isExpanded && files.length > 0) {
        files.forEach(file => {
            const fileNode = createFileNode(file, folder.name, level + 1);
            childrenContainer.appendChild(fileNode);
        });
    } else if (isExpanded && files.length === 0) {
        // 现代化风格：计算空文件夹的缩进（level + 1 层级，每层 18px）
        const emptyIndent = 30 + ((level + 1) * 18);
        childrenContainer.innerHTML = `<div class="tree-empty" style="padding-left: ${emptyIndent}px;">空文件夹</div>`;
    }
    
    return folderDiv;
}

/**
 * 切换文件夹展开/收起状态
 */
async function toggleFolder(folderName) {
    const currentState = folderStates[folderName];
    const newExpandedState = !currentState.expanded;
    
    folderStates[folderName].expanded = newExpandedState;
    
    // 如果展开且还没加载文件，则加载文件
    if (newExpandedState && currentState.files.length === 0) {
        await loadFolderFiles(folderName);
    } else {
        renderFolderStructure();
    }
}

/**
 * 加载文件夹内的文件
 */
async function loadFolderFiles(folderName) {
    try {
        const response = await fetch(`/api/projects/${currentProject}/files/${folderName}`);
        const data = await response.json();
        
        if (data.success) {
            // 过滤掉备份文件和修订历史文件
            const files = data.files
                .filter(f => {
                    const name = f.filename.toLowerCase();
                    return name.endsWith('.md') && 
                           !name.includes('.backup-') && 
                           !name.includes('.revision-history');
                })
                .map(f => ({
                    filename: f.filename,
                    title: f.title,
                    folderName: folderName,
                    modified: new Date(f.modified)
                }));
            
            folderStates[folderName].files = files;
            
            // 如果是章节内容，更新全局chapters和标签页
            if (folderName === '章节内容') {
                chapters = files;
            renderChapterTabs();
            }
            
            renderFolderStructure();
        }
    } catch (error) {
        console.error(`加载文件夹 ${folderName} 失败:`, error);
    }
}

/**
 * 创建文件节点
 */
function createFileNode(file, folderName, level) {
    const fileDiv = document.createElement('div');
    fileDiv.className = 'tree-node';
    
    const isActive = currentChapter?.filename === file.filename && 
                     currentChapter?.folderName === folderName;
    
    // VSCode 风格：使用 data-depth 属性，选中状态
    fileDiv.innerHTML = `
        <div class="tree-item file ${isActive ? 'selected' : ''}" data-depth="${level}" draggable="true">
            <span class="tree-spacer"></span>
            <span class="tree-icon">📄</span>
            <span class="tree-label">${file.title}</span>
        </div>
    `;
    
    const fileItem = fileDiv.querySelector('.tree-item');
    
    // 单击编辑
    fileItem.addEventListener('click', async (e) => {
        e.stopPropagation();
        await editFile(folderName, file);
    });
    
    // 右键菜单
    fileItem.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const filePath = folderName ? `${folderName}/${file.filename}` : file.filename;
        showContextMenu(e, { 
            type: 'file', 
            folderName: folderName,
            filename: file.filename,
            title: file.title,
            path: filePath
        });
    });
    
    // 拖拽开始
    fileItem.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        const filePath = folderName ? `${folderName}/${file.filename}` : file.filename;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({
            type: 'file',
            path: filePath,
            folderName: folderName,
            filename: file.filename
        }));
        fileItem.classList.add('dragging');
    });
    
    // 拖拽结束
    fileItem.addEventListener('dragend', (e) => {
        fileItem.classList.remove('dragging');
    });
    
    return fileDiv;
}

/**
 * 更新编辑器缺省页显示状态
 */
function updateEditorEmptyState() {
    if (currentChapter === null || openedTabs.length === 0) {
        // 显示缺省页
        editorEmptyState.classList.remove('hidden');
        chapterTitleInput.disabled = true;
        chapterContentEditor.disabled = true;
        saveChapterBtn.disabled = true;
    } else {
        // 隐藏缺省页
        editorEmptyState.classList.add('hidden');
        chapterTitleInput.disabled = false;
        chapterContentEditor.disabled = false;
        saveChapterBtn.disabled = false;
    }
}

/**
 * 更新内容统计（番茄小说字数统计法）
 */
function updateContentStats() {
    const content = chapterContentEditor.value || '';
    
    // 字数统计 - 番茄小说统计法（只统计中文字符、英文单词和数字）
    // 移除所有标点符号和空白字符
    const chineseChars = content.match(/[\u4e00-\u9fa5]/g) || [];
    const englishWords = content.match(/[a-zA-Z]+/g) || [];
    const numbers = content.match(/\d+/g) || [];
    
    const totalWords = chineseChars.length + englishWords.length + numbers.length;
    
    // 段落统计 - 按换行符分割，过滤空段落
    const paragraphs = content.split(/\n+/).filter(p => p.trim().length > 0);
    const totalParagraphs = paragraphs.length;
    
    // 预计阅读时长 - 按照每分钟400字计算
    const minutes = Math.ceil(totalWords / 400);
    const readingTimeText = minutes < 1 ? '< 1分钟' : `${minutes}分钟`;
    
    // 更新显示
    if (wordCount) wordCount.textContent = totalWords.toLocaleString();
    if (paragraphCount) paragraphCount.textContent = totalParagraphs.toLocaleString();
    if (readingTime) readingTime.textContent = readingTimeText;
}

/**
 * 编辑文件
 */
async function editFile(folderName, file) {
    try {
        const filePath = folderName 
            ? `/api/projects/${currentProject}/files/${folderName}/${file.filename}`
            : `/api/projects/${currentProject}/root-files/${file.filename}`;
            
        const response = await fetch(filePath);
        const data = await response.json();
        
        if (data.success) {
            // 标题：使用文件名（去掉 .md 后缀）
            let title = file.title;
            if (title.endsWith('.md')) {
                title = title.slice(0, -3);
            }
            
            // 内容：如果第一行是标题，去掉它（因为会在标题框中显示）
            let content = data.content;
            const lines = content.split('\n');
            if (lines.length > 0 && lines[0].startsWith('# ')) {
                // 去掉第一行标题和后面的空行
                content = lines.slice(1).join('\n').trim();
            }
            
            currentChapter = {
                ...file,
                folderName: folderName,
                content: data.content, // 保存原始完整内容
                title: title
            };
            
            chapterTitleInput.value = title;
            chapterTitleInput.disabled = false;
            chapterContentEditor.value = content;
            chapterContentEditor.disabled = false;
            chapterContentEditor.style.background = '#fafafa';
            
            // 更新保存按钮状态
            saveChapterBtn.textContent = '保存';
            saveChapterBtn.disabled = false;
            
            // 添加到打开的标签页（如果还没有）
            const tabKey = `${folderName || 'root'}/${file.filename}`;
            const existingTab = openedTabs.find(t => t.key === tabKey);
            if (!existingTab) {
                openedTabs.push({
                    key: tabKey,
                    folderName: folderName,
                    filename: file.filename,
                    title: file.title
                });
            }
            
            renderFolderStructure();
            renderChapterTabs();
            
            // 更新内容统计
            updateContentStats();
            
            // 更新缺省页状态
            updateEditorEmptyState();
        }
    } catch (error) {
        console.error('加载文件失败:', error);
        alert('❌ 加载文件失败');
    }
}

function renderChapterTabs() {
    chapterTabs.innerHTML = '';
    
    openedTabs.forEach(tab => {
        const tabDiv = document.createElement('div');
        tabDiv.className = 'chapter-tab';
        if (currentChapter?.filename === tab.filename && currentChapter?.folderName === tab.folderName) {
            tabDiv.classList.add('active');
        }
        
        const labelSpan = document.createElement('span');
        labelSpan.textContent = tab.title;
        labelSpan.addEventListener('click', async () => {
            await editFile(tab.folderName, { filename: tab.filename, title: tab.title });
        });
        
        const closeBtn = document.createElement('span');
        closeBtn.className = 'tab-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeTab(tab.key);
        });
        
        tabDiv.appendChild(labelSpan);
        tabDiv.appendChild(closeBtn);
        chapterTabs.appendChild(tabDiv);
    });
}

function closeTab(tabKey) {
    const tabIndex = openedTabs.findIndex(t => t.key === tabKey);
    if (tabIndex === -1) return;
    
    const closedTab = openedTabs[tabIndex];
    openedTabs.splice(tabIndex, 1);
    
    // 如果关闭的是当前标签页，切换到其他标签页
    if (currentChapter?.filename === closedTab.filename && currentChapter?.folderName === closedTab.folderName) {
        if (openedTabs.length > 0) {
            const nextTab = openedTabs[Math.max(0, tabIndex - 1)];
            editFile(nextTab.folderName, { filename: nextTab.filename, title: nextTab.title });
        } else {
            // 没有打开的标签页了，清空编辑器
            currentChapter = null;
            chapterTitleInput.value = '';
            chapterContentEditor.value = '';
            saveChapterBtn.disabled = true;
            updateContentStats(); // 重置统计
            renderFolderStructure();
        }
    }
    
    renderChapterTabs();
    updateEditorEmptyState(); // 更新缺省页状态
}

async function createNewChapter() {
    if (!currentProject) {
        alert('请先选择项目');
        return;
    }
    
    // 询问在哪个文件夹创建文件
    let targetFolder = null;
    if (projectFolders.length > 0) {
        const folderChoice = prompt(
            `请选择文件夹（输入数字）：\n0. 根目录\n${projectFolders.map((f, i) => `${i + 1}. ${f.name}`).join('\n')}`,
            '1'
        );
        if (folderChoice === null) return;
        
        const folderIndex = parseInt(folderChoice);
        if (folderIndex > 0 && folderIndex <= projectFolders.length) {
            targetFolder = projectFolders[folderIndex - 1].name;
        }
    }
    
    const filename = prompt('请输入文件名（包含.md后缀）:', 'untitled.md');
    if (!filename) return;
    
    const content = `# 新建文件\n\n创建于 ${new Date().toLocaleString()}`;
    
    try {
        const url = targetFolder 
            ? `/api/projects/${currentProject}/files/${targetFolder}/${filename}`
            : `/api/projects/${currentProject}/root-files/${filename}`;
        const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 🔥 确保目标文件夹展开
            if (targetFolder && folderStates[targetFolder]) {
                folderStates[targetFolder].expanded = true;
            }
            
            // 🔥 清除缓存并重新加载文件夹结构
            await loadProjectFolders(true);
            
            // 自动打开新创建的文件
            await editFile(targetFolder, { filename, title: filename });
        }
    } catch (error) {
        console.error('创建文件失败:', error);
        alert('创建文件失败: ' + error.message);
    }
}

async function saveCurrentChapter() {
    if (!currentChapter || !currentProject) {
        alert('请先选择文件');
        return;
    }
    
    const newTitle = chapterTitleInput.value.trim();
    const bodyContent = chapterContentEditor.value;
    const folderName = currentChapter.folderName;
    const oldFilename = currentChapter.filename;
    
    // 检查标题是否改变（需要重命名文件）
    let oldTitle = currentChapter.title;
    if (oldTitle.endsWith('.md')) {
        oldTitle = oldTitle.slice(0, -3);
    }
    const titleChanged = newTitle !== oldTitle;
    const newFilename = titleChanged ? `${newTitle}.md` : oldFilename;
    
    // 构建完整的文件内容：标题 + 内容
    let fullContent = '';
    if (newTitle) {
        fullContent = `# ${newTitle}\n\n${bodyContent}`;
    } else {
        fullContent = bodyContent;
    }
    
    try {
        // 如果标题改变，先重命名文件
        if (titleChanged) {
            const oldPath = folderName ? `${folderName}/${oldFilename}` : oldFilename;
            const renameResponse = await fetch(`/api/projects/${currentProject}/items/rename`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    oldPath, 
                    newName: newFilename,
                    isFolder: false
                })
            });
            
            const renameData = await renameResponse.json();
            if (!renameData.success) {
                alert('❌ 重命名失败: ' + renameData.error);
                return;
            }
            
            // 更新当前章节的文件名
            currentChapter.filename = newFilename;
            currentChapter.title = newTitle;
            
            // 更新标签页的key和信息
            const oldTabKey = `${folderName || 'root'}/${oldFilename}`;
            const newTabKey = `${folderName || 'root'}/${newFilename}`;
            const tab = openedTabs.find(t => t.key === oldTabKey);
            if (tab) {
                tab.key = newTabKey;
                tab.filename = newFilename;
                tab.title = newTitle;
            }
        }
        
        // 保存文件内容（使用新文件名）
        const saveUrl = folderName 
            ? `/api/projects/${currentProject}/files/${folderName}/${currentChapter.filename}`
            : `/api/projects/${currentProject}/root-files/${currentChapter.filename}`;
            
        const response = await fetch(saveUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: fullContent })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentChapter.content = fullContent;
            currentChapter.title = newTitle;
            
            alert('✅ 保存成功' + (titleChanged ? '（已重命名文件）' : ''));
            
            // 更新标签页显示
            renderChapterTabs();
            
            // 更新文件树中的标题显示
            await loadProjectFolders();
            if (folderName && folderStates[folderName]?.expanded) {
                await loadFolderFiles(folderName);
            }
            
            // 更新文件树中的选中状态
            renderFolderStructure();
        }
    } catch (error) {
        console.error('保存文件失败:', error);
        alert('❌ 保存失败: ' + error.message);
    }
}

// ==================== AI助手 - 对话历史 ====================
async function loadConversationHistory() {
    try {
        const response = await fetch(`/api/projects/${currentProject}/conversation-history`);
        const data = await response.json();
        
        chatMessages.innerHTML = '';
        
        if (data.success && data.history && data.history.length > 0) {
            data.history.forEach((msg, index) => {
                addMessage(msg.role, msg.content, false, msg.metadata, index);
            });
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } else {
            showWelcomeMessage();
        }
    } catch (error) {
        console.error('加载对话历史失败:', error);
        showWelcomeMessage();
    }
}

function showWelcomeMessage() {
    chatMessages.innerHTML = `
        <div class="welcome-message">
            <h2>👋 欢迎使用AI创作助手</h2>
            <p>请先选择或创建一个项目，然后告诉我你想做什么。</p>
            <div class="examples">
                <h3>💡 示例：</h3>
                <ul>
                    <li>"创作一个中国神界的主角角色，保存到人物设定里"</li>
                    <li>"列出所有人物设定文件"</li>
                    <li>"读取第一章的内容"</li>
                    <li>"写第三章"</li>
                </ul>
            </div>
        </div>
    `;
}

async function clearHistory() {
    if (!currentProject) return;
    if (!confirm('确定要清空对话历史吗？')) return;
    
    try {
        const response = await fetch(`/api/projects/${currentProject}/clear-history`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            chatMessages.innerHTML = '';
            showWelcomeMessage();
        }
    } catch (error) {
        console.error('清空历史失败:', error);
    }
}

// ==================== AI助手 - 发送消息（完整流式输出） ====================
async function sendMessage() {
    if (!currentProject) {
        alert('请先选择项目');
        return;
    }
    
    const message = chatInput.value.trim();
    if (!message || isGenerating) return;
    
    // 构建完整的提示词
    let fullPrompt = message;
    if (referencedFiles.length > 0) {
        const projectFiles = referencedFiles.filter(r => r.type === 'project');
        const uploadFiles = referencedFiles.filter(r => r.type === 'upload');
        
        fullPrompt = '';
        
        if (projectFiles.length > 0) {
            fullPrompt += '【用户引用的项目文件】\n\n';
            projectFiles.forEach(ref => {
                fullPrompt += `- @${ref.title} (路径: ${ref.source})\n`;
            });
            fullPrompt += '\n💡 提示：使用 read_file 工具读取这些文件的内容。\n\n';
        }
        
        if (uploadFiles.length > 0) {
            fullPrompt += '【用户上传的文件内容】\n\n';
            uploadFiles.forEach(ref => {
                fullPrompt += `## 文件: ${ref.title}\n\`\`\`\n${ref.content}\n\`\`\`\n\n`;
            });
        }
        
        fullPrompt += `【用户问题】\n${message}`;
    }
    
    // 添加用户消息
    let displayMessage = message;
    if (referencedFiles.length > 0) {
        const refTags = referencedFiles.map(ref => `@${ref.title}`).join(' ');
        displayMessage = `${refTags}\n\n${message}`;
    }
    addMessage('user', displayMessage);
    chatInput.value = '';
    
    // 清空引用
    clearAllReferences();
    
    // 开始生成
    isGenerating = true;
    loadingIndicator.style.display = 'flex';
    sendBtn.querySelector('span:first-child').style.display = 'none';
    sendBtn.querySelector('.loading').textContent = '⏹ 终止';
    sendBtn.querySelector('.loading').style.display = 'inline';
    
    // 🔥 禁用项目切换（防止推理过程中切换项目导致中断）
    disableProjectSwitching();
    
    try {
        const response = await fetch(`/api/projects/${currentProject}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: fullPrompt,
                originalMessage: message
            })
        });
        
        if (!response.ok) {
            throw new Error(`服务器错误 (${response.status})`);
        }
        
        currentReader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let assistantMessage = null;
        
        while (true) {
            const { done, value } = await currentReader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop();
            
            for (const line of lines) {
                if (!line.trim() || line.startsWith(':')) continue;
                
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.substring(6));
                    
                    if (data.type === 'start') {
                        currentReasoningSteps = [];
                        currentStepIndex = 0;
                        currentStepContent = '';
                        
                        assistantMessage = addMessage('assistant', '');
                        const content = assistantMessage.querySelector('.message-content');
                        content.innerHTML = `
                            <div class="reasoning-container" style="margin-bottom: 15px;">
                                <div class="reasoning-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #e0e0e0;">
                                    <span style="font-weight: 600; color: #333; font-size: 14px;">🧠 推理过程</span>
                                    <button class="toggle-all-reasoning" style="background: none; border: 1px solid #ddd; border-radius: 4px; padding: 4px 12px; cursor: pointer; font-size: 12px; color: #666;">全部折叠</button>
                                </div>
                                <div class="reasoning-steps" style="display: flex; flex-direction: column; gap: 10px;"></div>
                                <div class="thinking-loading" style="display: flex; align-items: center; gap: 8px; margin-top: 10px; color: #999; font-size: 13px;">
                                    <div class="loading-spinner" style="width: 16px; height: 16px; border: 2px solid #e0e0e0; border-top-color: #667eea; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                                    <span>AI 正在思考中...</span>
                                </div>
                            </div>
                            <div class="final-answer" style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #e8e8e8;"></div>
                        `;
                        
                        const toggleAllBtn = content.querySelector('.toggle-all-reasoning');
                        let allCollapsed = false;
                        toggleAllBtn.addEventListener('click', () => {
                            const steps = content.querySelectorAll('.reasoning-step');
                            allCollapsed = !allCollapsed;
                            steps.forEach(step => {
                                const stepContent = step.querySelector('.step-content');
                                const toggle = step.querySelector('.step-toggle');
                                if (allCollapsed) {
                                    stepContent.style.display = 'none';
                                    toggle.textContent = '▶';
                                } else {
                                    stepContent.style.display = 'block';
                                    toggle.textContent = '▼';
                                }
                            });
                            toggleAllBtn.textContent = allCollapsed ? '全部展开' : '全部折叠';
                        });
                    } else if (data.type === 'iteration_start') {
                        if (assistantMessage) {
                            if (currentStepIndex > 0) {
                                const prevStep = assistantMessage.querySelector(`.reasoning-step[data-step-index="${currentStepIndex}"]`);
                                if (prevStep) {
                                    const status = prevStep.querySelector('.step-status');
                                    if (status && status.textContent === '思考中...') {
                                        status.textContent = '✓ 完成';
                                        status.style.color = '#52c41a';
                                    }
                                }
                                
                                currentReasoningSteps.push({
                                    index: currentStepIndex,
                                    title: currentStepIndex === 1 ? '初始分析' : `第 ${currentStepIndex} 轮推理`,
                                    content: currentStepContent || '(无输出)'
                                });
                            }
                            
                            currentStepIndex++;
                            currentStepContent = '';
                            
                            const stepsContainer = assistantMessage.querySelector('.reasoning-steps');
                            if (stepsContainer) {
                                const stepDiv = document.createElement('div');
                                stepDiv.className = 'reasoning-step';
                                stepDiv.dataset.stepIndex = currentStepIndex;
                                stepDiv.style.cssText = 'background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden;';
                                
                                const stepTitle = currentStepIndex === 1 ? '初始分析' : `第 ${currentStepIndex} 轮推理`;
                                
                                stepDiv.innerHTML = `
                                    <div class="step-header" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #fff; border-bottom: 1px solid #e0e0e0; cursor: pointer;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <span class="step-toggle" style="font-weight: bold; color: #666; user-select: none;">▼</span>
                                            <span class="step-title" style="font-weight: 600; color: #444; font-size: 13px;">${stepTitle}</span>
                                        </div>
                                        <span class="step-status" style="font-size: 11px; color: #999;">思考中...</span>
                                    </div>
                                    <div class="step-content" style="padding: 12px; font-family: 'Consolas', 'Monaco', monospace; white-space: pre-wrap; font-size: 11px; line-height: 1.6; color: #333; max-height: 300px; overflow-y: auto;"></div>
                                `;
                                
                                const header = stepDiv.querySelector('.step-header');
                                const content = stepDiv.querySelector('.step-content');
                                const toggle = stepDiv.querySelector('.step-toggle');
                                header.addEventListener('click', () => {
                                    if (content.style.display === 'none') {
                                        content.style.display = 'block';
                                        toggle.textContent = '▼';
                                    } else {
                                        content.style.display = 'none';
                                        toggle.textContent = '▶';
                                    }
                                });
                                
                                stepsContainer.appendChild(stepDiv);
                                stepDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            }
                        }
                    } else if (data.type === 'llm_stream') {
                        if (assistantMessage) {
                                if (currentStepIndex === 0) currentStepIndex = 1;
                                
                            currentStepContent = data.data;
                            
                            const currentStep = assistantMessage.querySelector(`.reasoning-step[data-step-index="${currentStepIndex}"]`);
                            if (currentStep) {
                                const stepContent = currentStep.querySelector('.step-content');
                                if (stepContent) {
                                    stepContent.textContent = currentStepContent;
                                    stepContent.scrollTop = stepContent.scrollHeight;
                                }
                            }
                        }
                    } else if (data.type === 'progress') {
                        if (assistantMessage) {
                                if (currentStepIndex === 0) currentStepIndex = 1;
                                
                            if (currentStepContent && !currentStepContent.endsWith('\n')) {
                                currentStepContent += '\n';
                            }
                            currentStepContent += data.data;
                            
                            const currentStep = assistantMessage.querySelector(`.reasoning-step[data-step-index="${currentStepIndex}"]`);
                            if (currentStep) {
                                const stepContent = currentStep.querySelector('.step-content');
                                if (stepContent) {
                                    stepContent.textContent = currentStepContent;
                                    stepContent.scrollTop = stepContent.scrollHeight;
                                }
                            }
                        }
                    } else if (data.type === 'content') {
                        if (assistantMessage) {
                            const finalAnswer = assistantMessage.querySelector('.final-answer');
                            if (finalAnswer) {
                                finalAnswer.innerHTML = marked.parse(data.data);
                                }
                            }
                    } else if (data.type === 'diff') {
                        // 处理 diff 事件：显示文件修改预览
                        showFileDiff(data.data);
                    } else if (data.type === 'done') {
                        if (assistantMessage) {
                            if (currentStepContent && currentStepIndex > 0) {
                                const alreadySaved = currentReasoningSteps.some(s => s.index === currentStepIndex);
                                if (!alreadySaved) {
                                    currentReasoningSteps.push({
                                        index: currentStepIndex,
                                        title: currentStepIndex === 1 ? '初始分析' : `第 ${currentStepIndex} 轮推理`,
                                        content: currentStepContent
                                    });
                                }
                            }
                            
                            const allSteps = assistantMessage.querySelectorAll('.reasoning-step');
                            allSteps.forEach(step => {
                                const status = step.querySelector('.step-status');
                                if (status && status.textContent === '思考中...') {
                                    status.textContent = '✓ 完成';
                                    status.style.color = '#52c41a';
                                }
                            });
                            
                            const loadingDiv = assistantMessage.querySelector('.thinking-loading');
                            if (loadingDiv) {
                                loadingDiv.style.display = 'none';
                            }
                            
                            assistantMessage.dataset.reasoningSteps = JSON.stringify(currentReasoningSteps);
                            }
                    } else if (data.type === 'max_iterations') {
                        // 🔥 达到最大推理次数，显示友好提示（不是错误）
                        if (assistantMessage) {
                            const finalAnswer = assistantMessage.querySelector('.final-answer');
                            if (finalAnswer) {
                                finalAnswer.innerHTML = `<div style="color: #fa8c16; padding: 12px; background: #fff7e6; border: 1px solid #ffd591; border-radius: 4px;">
                                    ⚠️ ${data.data}
                                </div>`;
                            }
                        } else {
                            addMessage('assistant', `⚠️ ${data.data}`);
                        }
                        console.log(`⚠️ 达到最大推理次数：${data.iterations} 轮`);
                    } else if (data.type === 'error') {
                        if (assistantMessage) {
                            const finalAnswer = assistantMessage.querySelector('.final-answer');
                            if (finalAnswer) {
                                finalAnswer.innerHTML = `<div style="color: #ff4d4f; padding: 12px; background: #fff2f0; border: 1px solid #ffccc7; border-radius: 4px;">❌ 错误: ${data.data}</div>`;
                            }
                        } else {
                            addMessage('assistant', `❌ 错误: ${data.data}`);
                        }
                    }
                    } catch (error) {
                        console.error('解析SSE数据失败:', error);
                    }
                }
            }
        }
    } catch (error) {
        console.error('发送消息失败:', error);
        
        // 🔥 判断是否为用户主动终止
        const isUserAborted = error.name === 'AbortError' || 
                             error.message?.includes('abort') || 
                             error.message?.includes('cancel');
        
        if (isUserAborted) {
            console.log('✅ 用户已终止 AI 推理');
            // 不显示错误消息，因为是用户主动终止
        } else {
            addMessage('assistant', `❌ 错误: ${error.message}`);
        }
    } finally {
        // 🔥 确保清理状态
        isGenerating = false;
        loadingIndicator.style.display = 'none';
        currentReader = null;
        sendBtn.querySelector('span:first-child').style.display = 'inline';
        sendBtn.querySelector('.loading').style.display = 'none';
        
        // 🔥 重新启用项目切换
        enableProjectSwitching();
        
        console.log('✅ sendMessage 完成，UI 已恢复');
        
        // 🔥 延迟刷新文件列表（避免影响AI推理过程）
        setTimeout(async () => {
            try {
                await loadProjectData(true);
                console.log('✅ 项目文件已刷新');
            } catch (error) {
                console.error('刷新文件失败:', error);
            }
        }, 500);  // 延迟500ms后刷新
    }
}

async function stopGenerating() {
    console.log('🛑 用户手动终止 AI 推理');
    
    // 🔥 先取消 reader（这会中断 while 循环）
    if (currentReader) {
        try {
            await currentReader.cancel();
        } catch (e) {
            console.log('Reader 取消完成');
        }
        currentReader = null;
    }
    
    // 🔥 发送停止请求到后端
    try {
        await fetch(`/api/projects/${currentProject}/stop`, {
            method: 'POST'
        });
    } catch (error) {
        console.error('停止生成失败:', error);
    }
    
    // 🔥 立即清除 loading 状态
    isGenerating = false;
    loadingIndicator.style.display = 'none';
    sendBtn.querySelector('span:first-child').style.display = 'inline';
    sendBtn.querySelector('.loading').style.display = 'none';
    
    // 🔥 重新启用项目切换
    enableProjectSwitching();
    
    console.log('✅ AI 推理已终止，UI 已恢复');
}

function addMessage(role, content, scrollToBottom = true, metadata = null, index = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${role}`;
    
    const roleLabel = document.createElement('div');
    roleLabel.className = 'message-role';
    roleLabel.textContent = role === 'user' ? '👤 用户' : '🤖 AI 助手';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (role === 'assistant') {
        if (metadata && metadata.reasoningSteps && metadata.reasoningSteps.length > 0) {
            // 渲染推理过程（历史消息）
            contentDiv.innerHTML = `
                <div class="reasoning-container" style="margin-bottom: 15px;">
                    <div class="reasoning-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #e0e0e0;">
                        <span style="font-weight: 600; color: #333; font-size: 14px;">🧠 推理过程</span>
                        <button class="toggle-all-reasoning" style="background: none; border: 1px solid #ddd; border-radius: 4px; padding: 4px 12px; cursor: pointer; font-size: 12px; color: #666;">全部折叠</button>
                    </div>
                    <div class="reasoning-steps" style="display: flex; flex-direction: column; gap: 10px;"></div>
                </div>
                <div class="final-answer" style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #e8e8e8;">${marked.parse(content)}</div>
            `;
            
            // 渲染每个推理步骤
            const stepsContainer = contentDiv.querySelector('.reasoning-steps');
            metadata.reasoningSteps.forEach((step, stepIndex) => {
                const stepDiv = document.createElement('div');
                stepDiv.className = 'reasoning-step';
                stepDiv.style.cssText = 'background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden;';
                
                stepDiv.innerHTML = `
                    <div class="step-header" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #fff; border-bottom: 1px solid #e0e0e0; cursor: pointer;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="step-toggle" style="font-weight: bold; color: #666; user-select: none;">▶</span>
                            <span class="step-title" style="font-weight: 600; color: #444; font-size: 13px;">${step.title || '推理步骤 ' + (stepIndex + 1)}</span>
                        </div>
                        <span class="step-status" style="font-size: 11px; color: #52c41a;">✓ 完成</span>
                    </div>
                    <div class="step-content" style="display: none; padding: 12px; font-family: 'Consolas', 'Monaco', monospace; white-space: pre-wrap; font-size: 11px; line-height: 1.6; color: #333; max-height: 300px; overflow-y: auto;">${step.content}</div>
                `;
                
                const header = stepDiv.querySelector('.step-header');
                const stepContent = stepDiv.querySelector('.step-content');
                const toggle = stepDiv.querySelector('.step-toggle');
                
                header.addEventListener('click', () => {
                    if (stepContent.style.display === 'none') {
                        stepContent.style.display = 'block';
                        toggle.textContent = '▼';
                    } else {
                        stepContent.style.display = 'none';
                        toggle.textContent = '▶';
                    }
                });
                
                stepsContainer.appendChild(stepDiv);
            });
            
            // 全部折叠/展开按钮
            const toggleAllBtn = contentDiv.querySelector('.toggle-all-reasoning');
            let allCollapsed = true;
            toggleAllBtn.addEventListener('click', () => {
                const steps = contentDiv.querySelectorAll('.reasoning-step');
                allCollapsed = !allCollapsed;
                steps.forEach(step => {
                    const stepContent = step.querySelector('.step-content');
                    const toggle = step.querySelector('.step-toggle');
                    if (allCollapsed) {
                        stepContent.style.display = 'none';
                        toggle.textContent = '▶';
                    } else {
                        stepContent.style.display = 'block';
                        toggle.textContent = '▼';
                    }
                });
                toggleAllBtn.textContent = allCollapsed ? '全部展开' : '全部折叠';
            });
        } else {
            contentDiv.innerHTML = marked.parse(content);
        }
    } else {
        contentDiv.textContent = content;
    }
    
    messageDiv.appendChild(roleLabel);
    messageDiv.appendChild(contentDiv);
    
    const welcome = chatMessages.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    
    chatMessages.appendChild(messageDiv);
    
    if (scrollToBottom) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    return messageDiv;
}

// ==================== AI助手 - 文件引用 ====================
function handleChatInputChange(e) {
    if (!currentProject) return;
    
    const text = chatInput.value;
    const cursorPos = chatInput.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
        if (!/[\s\n]/.test(textAfterAt)) {
            atStartPosition = lastAtIndex;
            showAtDropdown(textAfterAt);
        } else {
            closeAtDropdown();
        }
    } else {
        closeAtDropdown();
    }
}

function handleChatInputKeydown(e) {
    if (!atDropdownVisible) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isGenerating) sendMessage();
        }
        return;
    }
    
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveSelection(1);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveSelection(-1);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        selectCurrentItem();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        closeAtDropdown();
    }
}

async function showAtDropdown(searchText = '') {
    if (!currentProject) return;
    
    atDropdownVisible = true;
    atFileDropdown.style.display = 'flex';
    
    await loadAllFilesForAt();
    filterAndDisplayFiles(searchText);
}

function closeAtDropdown() {
    atDropdownVisible = false;
    atFileDropdown.style.display = 'none';
    atDropdownSelectedIndex = -1;
    atStartPosition = -1;
}

async function loadAllFilesForAt() {
    atDropdownFolders = [];
    
    try {
        // 使用动态的项目文件夹数据
        for (const folder of projectFolders) {
            const response = await fetch(`/api/projects/${currentProject}/files/${folder.name}`);
            const data = await response.json();
            
            if (data.success && data.files) {
                // 过滤掉备份文件和修订历史文件
                const filteredFiles = data.files.filter(f => {
                    const name = f.filename.toLowerCase();
                    return name.endsWith('.md') && 
                           !name.includes('.backup-') && 
                           !name.includes('.revision-history');
                });
                
                atDropdownFolders.push({
                    type: folder.name,
                    name: folder.name,
                    icon: '📁',
                    files: filteredFiles,
                    expanded: false,
                    isFolder: true
                });
            }
        }
    } catch (error) {
        console.error('加载文件失败:', error);
    }
}

function filterAndDisplayFiles(searchText) {
    atFileList.innerHTML = '';
    atDropdownItems = [];
    
    // 默认展开所有文件夹（除非有搜索文本时才折叠空文件夹）
    atDropdownFolders.forEach(folder => {
        if (!searchText) {
            folder.expanded = true;
        }
    });
    
    // 先显示根目录文件（如果有的话）
    if (rootFiles && rootFiles.length > 0) {
        const filteredRootFiles = searchText 
            ? rootFiles.filter(file => {
                const title = file.title || file.filename || '';
                const name = file.filename ? file.filename.toLowerCase() : '';
                return title.toLowerCase().includes(searchText.toLowerCase()) &&
                       name.endsWith('.md') && 
                       !name.includes('.backup-') && 
                       !name.includes('.revision-history');
            })
            : rootFiles.filter(f => {
                const name = f.filename ? f.filename.toLowerCase() : '';
                return name.endsWith('.md') && 
                       !name.includes('.backup-') && 
                       !name.includes('.revision-history');
            });
        
        filteredRootFiles.forEach(file => {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'at-file-item';
            fileDiv.style.paddingLeft = '12px';
            fileDiv.textContent = `📄 ${file.title || file.filename}`;
            fileDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                selectFile({ type: null, name: '', isFolder: false }, file);
            });
            atFileList.appendChild(fileDiv);
            atDropdownItems.push({ 
                type: 'file', 
                folder: { type: null, name: '', isFolder: false }, 
                file, 
                element: fileDiv 
            });
        });
    }
    
    // 然后显示文件夹
    atDropdownFolders.forEach((folder, folderIndex) => {
        const filteredFiles = searchText 
            ? folder.files.filter(file => {
                const title = file.title || '';
                return title.toLowerCase().includes(searchText.toLowerCase());
            })
            : folder.files;
        
        // 搜索时跳过没有匹配文件的文件夹
        if (searchText && filteredFiles.length === 0) return;
        
        const folderDiv = document.createElement('div');
        folderDiv.className = 'at-file-folder';
        
        const arrow = folder.expanded ? '▼' : '▶';
        folderDiv.innerHTML = `
            <div class="at-file-folder-header ${folder.expanded ? 'expanded' : ''}" style="padding: 10px 12px; cursor: pointer; font-weight: 600; color: #333;">
                <span style="margin-right: 8px;">${arrow}</span>
                <span>${folder.icon}</span>
                <span style="margin-left: 8px;">${folder.name}</span>
                <span style="margin-left: 8px; font-size: 11px; color: #999;">(${filteredFiles.length})</span>
            </div>
            <div class="at-file-folder-content" style="display: ${folder.expanded ? 'block' : 'none'}; padding-left: 20px;">
            </div>
        `;
        
        const header = folderDiv.querySelector('.at-file-folder-header');
        header.addEventListener('click', (e) => {
            e.stopPropagation();
            folder.expanded = !folder.expanded;
            filterAndDisplayFiles(searchText);
        });
        
        if (folder.expanded) {
            const contentDiv = folderDiv.querySelector('.at-file-folder-content');
            filteredFiles.forEach((file, index) => {
                const fileDiv = document.createElement('div');
                fileDiv.className = 'at-file-item';
                fileDiv.textContent = `📄 ${file.title || file.filename}`;
                fileDiv.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectFile(folder, file);
                });
                contentDiv.appendChild(fileDiv);
                atDropdownItems.push({ type: 'file', folder, file, element: fileDiv });
            });
        }
        
        atFileList.appendChild(folderDiv);
    });
    
    // 自动选中第一个文件（如果有的话）
    if (atDropdownItems.length > 0 && atDropdownSelectedIndex === -1) {
        atDropdownSelectedIndex = 0;
        updateSelection();
    }
}

function moveSelection(direction) {
    if (atDropdownItems.length === 0) return;
    
    atDropdownSelectedIndex += direction;
    
    if (atDropdownSelectedIndex < 0) {
        atDropdownSelectedIndex = atDropdownItems.length - 1;
    } else if (atDropdownSelectedIndex >= atDropdownItems.length) {
        atDropdownSelectedIndex = 0;
    }
    
    updateSelection();
}

function updateSelection() {
    atDropdownItems.forEach((item, index) => {
        if (index === atDropdownSelectedIndex) {
            item.element.classList.add('selected');
            item.element.scrollIntoView({ block: 'nearest' });
        } else {
            item.element.classList.remove('selected');
        }
    });
}

function selectCurrentItem() {
    if (atDropdownSelectedIndex >= 0 && atDropdownSelectedIndex < atDropdownItems.length) {
        const item = atDropdownItems[atDropdownSelectedIndex];
        if (item.type === 'file') {
            selectFile(item.folder, item.file);
        }
    }
}

function selectFile(folder, file) {
    // 构建正确的文件路径
    const source = folder.type ? `${folder.type}/${file.filename}` : file.filename;
    const title = file.title || file.filename.replace('.md', '');
    
    addReference({
        type: 'project',
        source: source,
        title: title,
        content: null
    });
    
    if (atStartPosition >= 0) {
        const text = chatInput.value;
        const before = text.substring(0, atStartPosition);
        const after = text.substring(chatInput.selectionStart);
        chatInput.value = before + `@${title} ` + after;
        
        const newPos = before.length + title.length + 2;
        chatInput.setSelectionRange(newPos, newPos);
        chatInput.focus();
    }
    
    closeAtDropdown();
}

function handleAtSearchInput(e) {
    atDropdownSelectedIndex = -1; // 重置选中索引
    filterAndDisplayFiles(e.target.value);
}

async function handleFileUpload(event) {
    const files = event.target.files;
    
    for (const file of files) {
        if (file.type === 'text/plain' || file.type === 'text/markdown' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
            try {
                const content = await file.text();
                addReference({
                    type: 'upload',
                    source: file.name,
                    title: file.name,
                    content: content
                });
            } catch (error) {
                console.error('读取文件失败:', error);
            }
        }
    }
    
    fileUploadInput.value = '';
}

function addReference(ref) {
    const exists = referencedFiles.some(r => r.source === ref.source);
    if (exists) return;
    
    referencedFiles.push(ref);
    updateReferenceDisplay();
}

function updateReferenceDisplay() {
    if (referencedFiles.length === 0) {
        fileReferenceArea.style.display = 'none';
        return;
    }
    
    fileReferenceArea.style.display = 'block';
    referenceList.innerHTML = '';
    
    referencedFiles.forEach((ref, index) => {
        const item = document.createElement('div');
        item.className = 'reference-item';
        
        const icon = ref.type === 'project' ? '📎' : '📤';
        
        item.innerHTML = `
            <span class="reference-item-icon">${icon}</span>
            <span class="reference-item-name" title="${ref.source}">${ref.title}</span>
            <button class="reference-item-remove" data-index="${index}" title="移除">×</button>
        `;
        
        const removeBtn = item.querySelector('.reference-item-remove');
        removeBtn.addEventListener('click', () => removeReference(index));
        
        referenceList.appendChild(item);
    });
}

function removeReference(index) {
    referencedFiles.splice(index, 1);
    updateReferenceDisplay();
}

function clearAllReferences() {
    referencedFiles = [];
    updateReferenceDisplay();
}

// ==================== 系统设置 ====================
async function openSettings() {
    showModal(settingsModal);
    await loadSystemPrompt();
    await loadApiConfig();
}

function switchSettingsTab(tabName) {
    // 切换tab按钮状态
    document.querySelectorAll('.settings-tab').forEach(tab => {
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // 切换panel显示
    document.querySelectorAll('.settings-panel').forEach(panel => {
        if (panel.dataset.panel === tabName) {
            panel.classList.add('active');
        } else {
            panel.classList.remove('active');
        }
    });
}

async function loadSystemPrompt() {
    try {
        const response = await fetch('/api/prompts/system');
        if (response.ok) {
            const data = await response.json();
            systemPromptEditor.value = data.content;
            
            // 显示当前使用的提示词文件路径
            const promptInfo = document.querySelector('.prompt-info');
            if (promptInfo && data.path) {
                promptInfo.innerHTML = `<p>⚠️ 当前编辑的提示词文件：<strong>${data.path}</strong></p><p>修改会影响所有项目的 AI 行为</p>`;
            }
        }
    } catch (error) {
        console.error('加载系统提示词失败:', error);
        alert('❌ 加载失败: ' + error.message);
    }
}

// 存储真实的API Key（用于显示/隐藏切换）
let realApiKey = '';

async function loadApiConfig() {
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                // 保存真实的API Key
                realApiKey = data.config.realApiKey || '';
                
                // 填充表单（不显示真实的API Key，只显示占位符）
                apiKeyInput.value = data.config.apiKey ? '••••••••••••••••' : '';
                apiKeyInput.type = 'password';
                apiBaseUrlInput.value = data.config.apiBaseUrl || '';
                modelNameInput.value = data.config.modelName || '';
                temperatureInput.value = data.config.temperature || '';
                maxIterationsInput.value = data.config.maxIterations || '';
            }
        }
    } catch (error) {
        console.error('加载API配置失败:', error);
    }
}

async function saveSystemPrompt() {
    if (!confirm('⚠️ 修改系统提示词会影响所有项目，确定要保存吗？')) {
            return;
        }
        
    try {
        const content = systemPromptEditor.value;
        const response = await fetch('/api/prompts/system', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        
        const data = await response.json();
        if (data.success) {
            alert(`✅ 系统提示词已保存到: ${data.path || '默认路径'}`);
            
            // 更新显示的路径信息
            const promptInfo = document.querySelector('.prompt-info');
            if (promptInfo && data.path) {
                promptInfo.innerHTML = `<p>⚠️ 当前编辑的提示词文件：<strong>${data.path}</strong></p><p>修改会影响所有项目的 AI 行为</p>`;
            }
        } else {
            alert('❌ 保存失败: ' + (data.error || '未知错误'));
        }
    } catch (error) {
        console.error('保存失败:', error);
        alert('❌ 保存失败: ' + error.message);
    }
}

async function saveApiConfig() {
    if (!confirm('⚠️ 修改API配置会影响所有AI调用，确定要保存吗？\n\n注意：配置将保存到 .env 文件中')) {
        return;
    }
    
    try {
        // 使用realApiKey而不是输入框的值（输入框可能是占位符）
        let apiKeyValue = realApiKey || apiKeyInput.value.trim();
        
        const config = {
            apiKey: apiKeyValue,
            apiBaseUrl: apiBaseUrlInput.value.trim(),
            modelName: modelNameInput.value.trim(),
            temperature: temperatureInput.value.trim(),
            maxIterations: maxIterationsInput.value.trim()
        };
        
        // 验证必填项
        if (!config.apiKey || config.apiKey === '••••••••••••••••') {
            alert('❌ 请输入API Key');
            return;
        }
        if (!config.apiBaseUrl) {
            alert('❌ 请输入API Base URL');
            return;
        }
        if (!config.modelName) {
            alert('❌ 请输入模型名称');
            return;
        }
        
        const response = await fetch('/api/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        
        const data = await response.json();
        if (data.success) {
            alert('✅ API配置已保存到 .env 文件\n\n⚠️ 需要重启服务器才能生效');
        } else {
            alert('❌ 保存失败: ' + (data.error || '未知错误'));
        }
    } catch (error) {
        console.error('保存API配置失败:', error);
        alert('❌ 保存失败: ' + error.message);
    }
}

async function testApiConnection() {
    try {
        testApiBtn.disabled = true;
        testApiBtn.textContent = '🔄 测试中...';
        
        const response = await fetch('/api/test-connection', {
            method: 'POST'
        });
        
        const data = await response.json();
        if (data.success) {
            alert(`✅ API连接测试成功！\n\n模型: ${data.model || '未知'}\n响应时间: ${data.responseTime || '未知'}ms`);
        } else {
            alert(`❌ API连接测试失败\n\n错误: ${data.error || '未知错误'}`);
        }
    } catch (error) {
        console.error('测试API连接失败:', error);
        alert('❌ 连接测试失败: ' + error.message);
    } finally {
        testApiBtn.disabled = false;
        testApiBtn.textContent = '🔍 测试连接';
    }
}

function toggleApiKeyVisibility() {
    const eyeIcon = toggleApiKeyBtn.querySelector('.eye-icon');
    
    if (apiKeyInput.type === 'password') {
        // 显示明文
        apiKeyInput.type = 'text';
        // 如果是占位符，显示真实的API Key
        if (apiKeyInput.value === '••••••••••••••••' && realApiKey) {
            apiKeyInput.value = realApiKey;
        }
        eyeIcon.textContent = '🙈';
        toggleApiKeyBtn.title = '隐藏';
    } else {
        // 隐藏
        apiKeyInput.type = 'password';
        // 如果显示的是真实API Key，切换回占位符
        if (apiKeyInput.value === realApiKey && realApiKey) {
            apiKeyInput.value = '••••••••••••••••';
        }
        eyeIcon.textContent = '👁️';
        toggleApiKeyBtn.title = '显示';
    }
}

// ==================== 右键菜单和文件管理 ====================

/**
 * 显示右键菜单
 */
function showContextMenu(event, target) {
    if (!currentProject) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    contextMenuTarget = target;
    console.log('显示右键菜单，目标:', target);
    
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.style.zIndex = '10000';
    
    // 根据类型显示/隐藏菜单项
    const newFileItem = contextMenu.querySelector('[data-action="newFile"]');
    const newFolderItem = contextMenu.querySelector('[data-action="newFolder"]');
    const renameItem = contextMenu.querySelector('[data-action="rename"]');
    const deleteItem = contextMenu.querySelector('[data-action="delete"]');
    
    if (target.type === 'root' || target.type === 'folder') {
        // 文件夹可以新建文件和文件夹
        newFileItem.style.display = 'flex';
        newFolderItem.style.display = 'flex';
        renameItem.style.display = target.type === 'folder' ? 'flex' : 'none';
        deleteItem.style.display = target.type === 'folder' ? 'flex' : 'none';
    } else if (target.type === 'file') {
        // 文件只能重命名和删除
        newFileItem.style.display = 'none';
        newFolderItem.style.display = 'none';
        renameItem.style.display = 'flex';
        deleteItem.style.display = 'flex';
    }
    
    console.log('菜单项显示状态:', {
        newFile: newFileItem.style.display,
        newFolder: newFolderItem.style.display,
        rename: renameItem.style.display,
        delete: deleteItem.style.display
    });
}

/**
 * 隐藏右键菜单
 */
function hideContextMenu() {
    contextMenu.style.display = 'none';
    contextMenuTarget = null;
}

/**
 * 处理右键菜单操作
 */
async function handleContextMenuAction(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const action = e.currentTarget.dataset.action;
    const target = contextMenuTarget;
    
    console.log('右键菜单操作:', action, target);
    
    hideContextMenu();
    
    if (!target) {
        console.error('没有选中的目标');
            return;
        }
        
    try {
        switch (action) {
            case 'newFile':
                showInputDialog('新建文件', '请输入文件名', async (fileName) => {
                    if (!fileName) return;
                    await createNewFile(fileName, target.folderName);
                });
                break;
                
            case 'newFolder':
                showInputDialog('新建文件夹', '请输入文件夹名', async (folderName) => {
                    if (!folderName) return;
                    await createNewFolder(folderName, target.folderName);
                });
                break;
                
            case 'rename':
                const currentName = target.type === 'file' 
                    ? target.title 
                    : target.folderName;
                showInputDialog('重命名', '请输入新名称', async (newName) => {
                    if (!newName || newName === currentName) return;
                    await renameItem(target, newName);
                }, currentName);
                break;
                
            case 'delete':
                await deleteItem(target);
                break;
                
            default:
                console.warn('未知操作:', action);
        }
    } catch (error) {
        console.error('处理右键菜单操作失败:', error);
        alert('操作失败: ' + error.message);
    }
}

/**
 * 显示输入对话框
 */
function showInputDialog(title, placeholder, callback, defaultValue = '') {
    inputDialogTitle.textContent = title;
    inputDialogValue.placeholder = placeholder;
    inputDialogValue.value = defaultValue;
    inputDialogCallback = callback;
    showModal(inputDialog);
    setTimeout(() => {
        inputDialogValue.focus();
        inputDialogValue.select();
    }, 100);
}

/**
 * 处理输入确认
 */
async function handleInputConfirm() {
    const value = inputDialogValue.value.trim();
    hideModal(inputDialog);
    
    if (inputDialogCallback) {
        await inputDialogCallback(value);
        inputDialogCallback = null;
    }
}

/**
 * 创建新文件
 */
async function createNewFile(fileName, folderName) {
    try {
        const response = await fetch(`/api/projects/${currentProject}/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName, folderName })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ 文件创建成功');
            // 🔥 清除缓存并刷新
            await loadProjectFolders(true);
        } else {
            alert('❌ ' + data.error);
        }
    } catch (error) {
        console.error('创建文件失败:', error);
        alert('❌ 创建文件失败');
    }
}

/**
 * 创建新文件夹
 */
async function createNewFolder(folderName, parentFolder) {
    try {
        const response = await fetch(`/api/projects/${currentProject}/folders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderName, parentFolder })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ 文件夹创建成功');
            await loadProjectFolders();
        } else {
            alert('❌ ' + data.error);
        }
    } catch (error) {
        console.error('创建文件夹失败:', error);
        alert('❌ 创建文件夹失败');
    }
}

/**
 * 重命名文件或文件夹
 */
async function renameItem(target, newName) {
    try {
        // 使用正确的路径
        const oldPath = target.path || (target.type === 'file'
            ? (target.folderName ? `${target.folderName}/${target.filename}` : target.filename)
            : target.folderName);
            
        console.log('重命名调试信息:', { 
            target: target,
            oldPath: oldPath, 
            newName: newName, 
            isFolder: target.type === 'folder',
            folderName: target.folderName,
            filename: target.filename
        });
            
        const response = await fetch(`/api/projects/${currentProject}/items/rename`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                oldPath, 
                newName,
                isFolder: target.type === 'folder'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ 重命名成功');
            
            // 如果是文件，需要更新已打开的标签页
            if (target.type === 'file') {
                const oldFilename = target.filename;
                const newFilename = newName.endsWith('.md') ? newName : `${newName}.md`;
                const folderName = target.folderName;
                
                // 更新 openedTabs 中的文件名和key
                const oldTabKey = `${folderName || 'root'}/${oldFilename}`;
                const newTabKey = `${folderName || 'root'}/${newFilename}`;
                const tab = openedTabs.find(t => t.key === oldTabKey);
                if (tab) {
                    tab.key = newTabKey;
                    tab.filename = newFilename;
                    tab.title = newName;
                }
                
                // 如果重命名的是当前打开的文件，更新 currentChapter
                if (currentChapter?.filename === oldFilename && currentChapter?.folderName === folderName) {
                    currentChapter.filename = newFilename;
                    currentChapter.title = newName;
                    // 重新渲染标签页
                    renderChapterTabs();
                }
                
                // 如果文件在某个文件夹中且该文件夹已展开，重新加载该文件夹的文件列表
                if (folderName && folderStates[folderName]?.expanded) {
                    // 先重新加载文件夹数据
                    await loadProjectFolders();
                    // 然后重新加载该文件夹的文件
                    await loadFolderFiles(folderName);
                } else {
                    // 否则只重新加载文件夹列表（会自动渲染）
                    await loadProjectFolders();
                }
            }
            // 如果是文件夹，需要更新该文件夹下所有已打开文件的标签页
            else if (target.type === 'folder') {
                const oldFolderName = target.folderName;
                const newFolderName = newName;
                
                // 更新所有该文件夹下文件的标签页
                openedTabs.forEach(tab => {
                    if (tab.folderName === oldFolderName) {
                        tab.folderName = newFolderName;
                        tab.key = `${newFolderName}/${tab.filename}`;
                    }
                });
                
                // 如果当前打开的文件在重命名的文件夹中，更新 currentChapter
                if (currentChapter?.folderName === oldFolderName) {
                    currentChapter.folderName = newFolderName;
                }
                
                // 更新 folderStates 中的文件夹状态
                if (folderStates[oldFolderName]) {
                    folderStates[newFolderName] = folderStates[oldFolderName];
                    delete folderStates[oldFolderName];
                }
                
                // 重新渲染标签页
                renderChapterTabs();
                
                // 重新加载项目数据（会自动渲染）
                await loadProjectFolders();
                
                // 如果新文件夹是展开的，重新加载该文件夹
                if (folderStates[newFolderName]?.expanded) {
                    await loadFolderFiles(newFolderName);
                }
            }
        } else {
            alert('❌ ' + data.error);
        }
    } catch (error) {
        console.error('重命名失败:', error);
        alert('❌ 重命名失败: ' + error.message);
    }
}

/**
 * 删除文件或文件夹
 */
/**
 * 移动文件到另一个文件夹
 */
async function moveFile(sourcePath, targetFolder) {
    try {
        const response = await fetch(`/api/projects/${currentProject}/items/move`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sourcePath,
                targetFolder
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 找出源文件夹和目标文件夹
            const sourceFolderName = sourcePath.includes('/') ? sourcePath.split('/')[0] : null;
            
            // 清空相关文件夹的文件缓存，强制重新加载
            if (sourceFolderName && folderStates[sourceFolderName]) {
                folderStates[sourceFolderName].files = [];
            }
            if (targetFolder && folderStates[targetFolder]) {
                folderStates[targetFolder].files = [];
            }
            
            // 重新加载文件夹结构
            await loadProjectFolders();
            
            // 重新加载展开的文件夹的文件
            if (sourceFolderName && folderStates[sourceFolderName]?.expanded) {
                await loadFolderFiles(sourceFolderName);
            }
            if (targetFolder && folderStates[targetFolder]?.expanded) {
                await loadFolderFiles(targetFolder);
            }
        } else {
            alert(`移动失败: ${data.error}`);
        }
    } catch (error) {
        console.error('移动文件失败:', error);
        alert('移动文件失败: ' + error.message);
    }
}

async function deleteItem(target) {
    const itemName = target.type === 'file' ? target.title : target.folderName;
    const itemType = target.type === 'file' ? '文件' : '文件夹';
    
    if (!confirm(`确定要删除${itemType} "${itemName}" 吗？${target.type === 'folder' ? '\n\n⚠️ 删除文件夹将同时删除其中的所有文件！' : ''}`)) {
        return;
    }
    
    try {
        // 使用正确的路径
        const itemPath = target.path || (target.type === 'file'
            ? (target.folderName ? `${target.folderName}/${target.filename}` : target.filename)
            : target.folderName);
            
        console.log('删除:', { itemPath, isFolder: target.type === 'folder' });
            
        const response = await fetch(`/api/projects/${currentProject}/items`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                itemPath,
                isFolder: target.type === 'folder'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ 删除成功');
            
            // 如果删除的是文件，从打开的标签页中移除
            if (target.type === 'file') {
                const tabKey = `${target.folderName || 'root'}/${target.filename}`;
                const tabIndex = openedTabs.findIndex(t => t.key === tabKey);
                if (tabIndex !== -1) {
                    openedTabs.splice(tabIndex, 1);
                }
                
                // 如果删除的是当前打开的文件，切换到其他文件或显示缺省页
                if (currentChapter?.filename === target.filename) {
                    if (openedTabs.length > 0) {
                        // 切换到下一个标签页
                        const nextTab = openedTabs[Math.max(0, tabIndex - 1)];
                        await editFile(nextTab.folderName, { filename: nextTab.filename, title: nextTab.title });
                    } else {
                        // 没有打开的标签页了，清空编辑器
                        currentChapter = null;
                        chapterTitleInput.value = '';
                        chapterContentEditor.value = '';
                        saveChapterBtn.disabled = true;
                        updateContentStats(); // 重置统计
                    }
                }
                updateEditorEmptyState(); // 更新缺省页状态
            }
            
            await loadProjectFolders();
            
            // 如果删除的是文件夹中的文件，重新加载该文件夹
            if (target.type === 'file' && target.folderName && folderStates[target.folderName]?.expanded) {
                await loadFolderFiles(target.folderName);
            }
        } else {
            alert('❌ ' + data.error);
        }
    } catch (error) {
        console.error('删除失败:', error);
        alert('❌ 删除失败: ' + error.message);
    }
}

// ==================== 工具函数 ====================
function showModal(modal) {
    modal.classList.add('show');
}

function hideModal(modal) {
    modal.classList.remove('show');
}

function formatTime(date) {
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / 3600000);
    
    if (hours < 1) return '刚刚';
    if (hours < 24) return `${hours}小时前`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}天前`;
    if (days < 30) return `${Math.floor(days / 7)}周前`;
    
    const months = Math.floor(days / 30);
    return `${months}月前`;
}

// 初始化应用
init();

