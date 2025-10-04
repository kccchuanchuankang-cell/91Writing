// 全局状态
let currentProject = null;
let isGenerating = false;
let currentReader = null; // 当前的 stream reader，用于终止输出
let currentPreviewFile = { type: null, filename: null, content: null }; // 当前预览的文件
let pendingChanges = { type: null, filename: null, oldContent: null, newContent: null }; // 待确认的修改

// Tab 管理
let openTabs = new Map(); // 存储打开的标签 { tabId: { type, filename, content, modified } }
let activeTabId = null; // 当前活动的标签 ID

// DOM 元素
const projectSelect = document.getElementById('projectSelect');
const newProjectBtn = document.getElementById('newProjectBtn');
const newProjectModal = document.getElementById('newProjectModal');
const newProjectName = document.getElementById('newProjectName');
const createProjectBtn = document.getElementById('createProjectBtn');
const cancelProjectBtn = document.getElementById('cancelProjectBtn');
const fileBrowser = document.getElementById('fileBrowser');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const refreshFilesBtn = document.getElementById('refreshFilesBtn');

// 文件预览区域元素
const tabList = document.getElementById('tabList');
const filePreviewContent = document.getElementById('filePreviewContent');
const filePreviewEditor = document.getElementById('filePreviewEditor');
const savePreviewBtn = document.getElementById('savePreviewBtn');
const normalPreview = document.getElementById('normalPreview');
const diffPreview = document.getElementById('diffPreview');
const filePreviewActions = document.getElementById('filePreviewActions');
const acceptChangesBtn = document.getElementById('acceptChangesBtn');
const rejectChangesBtn = document.getElementById('rejectChangesBtn');

// 文件编辑器元素
const fileEditorModal = document.getElementById('fileEditorModal');
const fileEditorTitle = document.getElementById('fileEditorTitle');
const fileEditorContent = document.getElementById('fileEditorContent');
const saveFileBtn = document.getElementById('saveFileBtn');
const cancelFileEditBtn = document.getElementById('cancelFileEditBtn');
const closeFileEditor = document.getElementById('closeFileEditor');

// 新建文件元素
const newFileBtn = document.getElementById('newFileBtn');
const newFileModal = document.getElementById('newFileModal');
const newFileType = document.getElementById('newFileType');
const newFileName = document.getElementById('newFileName');
const confirmNewFileBtn = document.getElementById('confirmNewFileBtn');
const cancelNewFileBtn = document.getElementById('cancelNewFileBtn');
const fileTree = document.getElementById('fileTree');

// 文件引用元素
const fileReferenceArea = document.getElementById('fileReferenceArea');
const referenceList = document.getElementById('referenceList');
const clearReferencesBtn = document.getElementById('clearReferencesBtn');
const uploadFileBtn = document.getElementById('uploadFileBtn');
const fileUploadInput = document.getElementById('fileUploadInput');
const selectProjectFileModal = document.getElementById('selectProjectFileModal');
const fileSelectorTree = document.getElementById('fileSelectorTree');
const confirmSelectFileBtn = document.getElementById('confirmSelectFileBtn');
const cancelSelectFileBtn = document.getElementById('cancelSelectFileBtn');
const closeSelectFileModal = document.getElementById('closeSelectFileModal');

// @ 下拉菜单元素
const atFileBtn = document.getElementById('atFileBtn');
const atFileDropdown = document.getElementById('atFileDropdown');
const atFileList = document.getElementById('atFileList');
const atFileSearchInput = document.getElementById('atFileSearchInput');

// 当前编辑的文件信息
let currentEditingFile = {
    type: null,
    filename: null
};

// 引用的文件列表
let referencedFiles = [];

// @ 下拉菜单状态
let atDropdownVisible = false;
let atDropdownFolders = []; // 存储文件夹结构
let atDropdownItems = []; // 存储所有可导航的项（文件夹+文件）
let atDropdownSelectedIndex = -1;
let atStartPosition = -1;

// 初始化
async function init() {
    await loadProjects();
    setupEventListeners();
}

// 加载项目列表
async function loadProjects() {
    try {
        const response = await fetch('/api/projects');
        const data = await response.json();
        
        if (data.success) {
            projectSelect.innerHTML = '<option value="">选择项目...</option>';
            data.projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.name;
                option.textContent = project.projectName || project.name;
                projectSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('加载项目失败:', error);
    }
}

// 设置事件监听
function setupEventListeners() {
    projectSelect.addEventListener('change', onProjectChange);
    newProjectBtn.addEventListener('click', () => newProjectModal.classList.add('show'));
    cancelProjectBtn.addEventListener('click', () => newProjectModal.classList.remove('show'));
    createProjectBtn.addEventListener('click', createProject);
    sendBtn.addEventListener('click', () => {
        if (isGenerating) {
            stopGenerating();
        } else {
            sendMessage();
        }
    });
    clearHistoryBtn.addEventListener('click', clearHistory);
    refreshFilesBtn.addEventListener('click', refreshAllFiles);
    
    // 移动端侧边栏抽屉
    mobileMenuBtn.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);
    
    // 移动端选择项目/文件后自动关闭侧边栏
    projectSelect.addEventListener('change', () => {
        if (window.innerWidth < 768) {
            closeSidebar();
        }
    });
    
    // 文件编辑器事件
    closeFileEditor.addEventListener('click', () => fileEditorModal.classList.remove('show'));
    cancelFileEditBtn.addEventListener('click', () => fileEditorModal.classList.remove('show'));
    saveFileBtn.addEventListener('click', saveEditedFile);
    
    // 文件预览区域事件
    savePreviewBtn.addEventListener('click', savePreviewFile);
    acceptChangesBtn.addEventListener('click', acceptFileChanges);
    rejectChangesBtn.addEventListener('click', rejectFileChanges);
    
    // 新建文件事件
    newFileBtn.addEventListener('click', () => newFileModal.classList.add('show'));
    cancelNewFileBtn.addEventListener('click', () => {
        newFileModal.classList.remove('show');
        newFileName.value = '';
    });
    confirmNewFileBtn.addEventListener('click', createNewFile);
    
    // 文件引用事件
    uploadFileBtn.addEventListener('click', () => fileUploadInput.click());
    fileUploadInput.addEventListener('change', handleFileUpload);
    clearReferencesBtn.addEventListener('click', clearAllReferences);
    closeSelectFileModal.addEventListener('click', () => selectProjectFileModal.classList.remove('show'));
    cancelSelectFileBtn.addEventListener('click', () => selectProjectFileModal.classList.remove('show'));
    confirmSelectFileBtn.addEventListener('click', confirmFileSelection);
    
    // @ 下拉菜单事件
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
            // 聚焦到搜索框
            setTimeout(() => {
                atFileSearchInput.focus();
            }, 100);
        }
    });
    chatInput.addEventListener('input', handleChatInputChange);
    chatInput.addEventListener('keydown', handleChatInputKeydown);
    atFileSearchInput.addEventListener('input', handleAtSearchInput);
    
    // 点击外部关闭下拉菜单
    document.addEventListener('click', (e) => {
        if (!atFileDropdown.contains(e.target) && e.target !== chatInput && e.target !== atFileBtn) {
            closeAtDropdown();
        }
    });
}

// 移动端侧边栏控制
function toggleSidebar() {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('active');
    if (sidebar.classList.contains('open')) {
        sidebarOverlay.style.display = 'block';
        // 强制重绘以触发过渡动画
        setTimeout(() => sidebarOverlay.classList.add('active'), 10);
    } else {
        sidebarOverlay.classList.remove('active');
        setTimeout(() => sidebarOverlay.style.display = 'none', 300);
    }
}

function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
    setTimeout(() => sidebarOverlay.style.display = 'none', 300);
}

// 项目切换
async function onProjectChange() {
    currentProject = projectSelect.value;
    
    if (currentProject) {
        await loadOverview();
        fileBrowser.style.display = 'block';
        
        // 🔥 加载对话历史
        await loadConversationHistory();
    } else {
        fileBrowser.style.display = 'none';
    }
}

// 🔥 加载对话历史
async function loadConversationHistory() {
    try {
        const response = await fetch(`/api/projects/${currentProject}/conversation-history`);
        const data = await response.json();
        
        // 总是先清空当前消息
            chatMessages.innerHTML = '';
        
        if (data.success && data.history && data.history.length > 0) {
            // 显示所有历史消息（带索引和元数据）
            data.history.forEach((msg, index) => {
                addMessage(msg.role, msg.content, false, msg.metadata, index);
            });
            
            // 最后滚动到底部
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            console.log(`✅ 加载了 ${data.history.length} 条历史对话`);
        } else {
            // 没有历史，显示欢迎消息
            chatMessages.innerHTML = `
                <div class="welcome-message">
                    <h2>👋 欢迎使用 ReAct Agent 小说创作系统</h2>
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
    } catch (error) {
        console.error('加载对话历史失败:', error);
        // 出错时也显示欢迎消息
        chatMessages.innerHTML = `
            <div class="welcome-message">
                <h2>👋 欢迎使用 ReAct Agent 小说创作系统</h2>
                <p>请先选择或创建一个项目，然后告诉我你想做什么。</p>
            </div>
        `;
    }
}

// 删除指定消息
async function deleteMessage(index) {
    if (!currentProject) return;
    
    if (!confirm('确定要删除这条消息吗？')) return;
    
    try {
        const response = await fetch(`/api/projects/${currentProject}/conversation-history/${index}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 重新加载对话历史
            await loadConversationHistory();
    } else {
            alert('删除失败：' + data.error);
        }
    } catch (error) {
        console.error('删除消息失败:', error);
        alert('删除失败：' + error.message);
    }
}

// 加载项目概览
async function loadOverview() {
    try {
        const response = await fetch(`/api/projects/${currentProject}/overview`);
        const data = await response.json();
        
        if (data.success) {
            // 加载文件树
            await loadFileTree(data.overview);
        }
    } catch (error) {
        console.error('加载概览失败:', error);
    }
}

// 加载文件树
async function loadFileTree(overview) {
    fileTree.innerHTML = '';
    
    const fileTypes = [
        { key: '人物设定', icon: '👤', name: '人物设定' },
        { key: '世界观设定', icon: '🌍', name: '世界观设定' },
        { key: '章节内容', icon: '📖', name: '章节内容' },
        { key: '大纲', icon: '📋', name: '大纲' },
        { key: '灵感记录', icon: '💡', name: '灵感记录' },
        { key: '设定资料', icon: '📚', name: '设定资料' },
        { key: '创作笔记', icon: '📝', name: '创作笔记' }
    ];
    
    for (const type of fileTypes) {
        const count = overview[type.key]?.count || 0;
        const folderDiv = document.createElement('div');
        folderDiv.className = 'file-tree-folder';  // 默认收起，不加 expanded
        folderDiv.dataset.type = type.key;
        
        folderDiv.innerHTML = `
            <div class="file-tree-folder-header">
                <div class="file-tree-folder-title">
                    <span class="file-tree-folder-arrow">▶</span>
                    <span>${type.icon} ${type.name}</span>
                </div>
                <span class="file-tree-folder-count">${count}</span>
            </div>
            <div class="file-tree-folder-content"></div>
        `;
        
        // 点击文件夹标题展开/折叠
        const header = folderDiv.querySelector('.file-tree-folder-header');
        header.addEventListener('click', () => {
            folderDiv.classList.toggle('expanded');
            // 如果是第一次展开，才加载文件
            if (folderDiv.classList.contains('expanded') && !folderDiv.dataset.loaded) {
                folderDiv.dataset.loaded = 'true';
                loadFilesForFolder(type.key, folderDiv.querySelector('.file-tree-folder-content'));
            }
        });
        
        fileTree.appendChild(folderDiv);
    }
}

// 🔥 刷新单个文件夹
async function refreshFileFolder(type) {
    if (!currentProject) return;
    
    // 查找该文件夹的 DOM 元素
    const folderDiv = document.querySelector(`.file-tree-folder[data-type="${type}"]`);
    if (!folderDiv) return;
    
    // 如果文件夹已展开，重新加载文件列表
    if (folderDiv.classList.contains('expanded')) {
        const container = folderDiv.querySelector('.file-tree-folder-content');
        if (container) {
            await loadFilesForFolder(type, container);
            console.log(`✅ 已刷新文件夹: ${type}`);
        }
    }
}

// 🔥 刷新所有已展开的文件夹
async function refreshAllFileFolders() {
    if (!currentProject) return;
    
    const expandedFolders = document.querySelectorAll('.file-tree-folder.expanded');
    for (const folderDiv of expandedFolders) {
        const type = folderDiv.dataset.type;
        const container = folderDiv.querySelector('.file-tree-folder-content');
        if (type && container) {
            await loadFilesForFolder(type, container);
        }
    }
    console.log(`✅ 已刷新 ${expandedFolders.length} 个文件夹`);
}

// 🔥 刷新整个文件树（手动点击刷新按钮时调用）
async function refreshAllFiles() {
    if (!currentProject) return;
    
    // 显示刷新动画
    const refreshBtn = refreshFilesBtn;
    refreshBtn.style.transform = 'rotate(360deg)';
    refreshBtn.style.transition = 'transform 0.5s';
    
    try {
        // 重新加载文件树
        await loadOverview();
        console.log('✅ 文件树已刷新');
    } finally {
        // 重置按钮动画
        setTimeout(() => {
            refreshBtn.style.transform = '';
        }, 500);
    }
}

// 为文件夹加载文件列表
async function loadFilesForFolder(type, container) {
    try {
        const response = await fetch(`/api/projects/${currentProject}/files/${type}`);
        const data = await response.json();
        
        console.log(`加载文件夹 ${type}:`, data); // 调试日志
        
        container.innerHTML = ''; // 先清空
        
        if (data.success && data.files && data.files.length > 0) {
            data.files.forEach(file => {
                const fileDiv = document.createElement('div');
                fileDiv.className = 'file-tree-file';
                fileDiv.innerHTML = `
                    <span class="file-tree-file-name" title="${file.title}">📄 ${file.title}</span>
                    <div class="file-tree-file-actions">
                        <button class="file-action-btn edit" data-type="${type}" data-filename="${file.filename}">编辑</button>
                        <button class="file-action-btn delete" data-type="${type}" data-filename="${file.filename}">删除</button>
                    </div>
                `;
                
                // 点击文件名打开编辑器
                const fileName = fileDiv.querySelector('.file-tree-file-name');
                fileName.addEventListener('click', () => viewFile(type, file.filename));
                
                // 编辑按钮 - 重命名文件
                const editBtn = fileDiv.querySelector('.edit');
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    renameFile(type, file.filename, file.title);
                });
                
                // 删除按钮
                const deleteBtn = fileDiv.querySelector('.delete');
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteFile(type, file.filename);
                });
                
                container.appendChild(fileDiv);
            });
            
            // 更新该文件夹的计数
            const folderDiv = container.closest('.file-tree-folder');
            const countSpan = folderDiv.querySelector('.file-tree-folder-count');
            if (countSpan) {
                countSpan.textContent = data.files.length;
            }
        } else {
            // 没有文件时也更新计数为0
            const folderDiv = container.closest('.file-tree-folder');
            const countSpan = folderDiv.querySelector('.file-tree-folder-count');
            if (countSpan) {
                countSpan.textContent = '0';
            }
        }
    } catch (error) {
        console.error('加载文件列表失败:', error);
    }
}

// 加载文件列表
async function loadFiles(type) {
    try {
        const response = await fetch(`/api/projects/${currentProject}/files/${type}`);
        const data = await response.json();
        
        if (data.success) {
            const fileList = document.getElementById('fileList');
            fileList.innerHTML = '';
            
            if (data.files.length === 0) {
                fileList.innerHTML = '<div style="color: #999; font-size: 12px;">暂无文件</div>';
                return;
            }
            
            data.files.forEach(file => {
                const div = document.createElement('div');
                div.className = 'file-item';
                div.innerHTML = `
                    <div class="file-item-title">${file.title}</div>
                    <div class="file-item-info">${new Date(file.modified).toLocaleString('zh-CN')}</div>
                `;
                div.addEventListener('click', () => viewFile(type, file.filename));
                fileList.appendChild(div);
            });
        }
    } catch (error) {
        console.error('加载文件失败:', error);
    }
}

// 查看文件 - 在中间预览区域显示（支持多标签）
// 重命名文件
async function renameFile(type, oldFilename, oldTitle) {
    const newTitle = prompt('请输入新的文件名（不含日期前缀和扩展名）:', oldTitle);
    
    if (!newTitle || newTitle === oldTitle) {
        return;
    }
    
    try {
        // 提取日期前缀
        const datePrefix = oldFilename.split('_')[0];
        const newFilename = `${datePrefix}_${newTitle}.md`;
        
        // 读取文件内容
        const response = await fetch(`/api/projects/${currentProject}/files/${type}/${oldFilename}`);
        if (!response.ok) {
            throw new Error('读取文件失败');
        }
        const data = await response.json();
        
        // 保存为新文件名
        const saveResponse = await fetch(`/api/projects/${currentProject}/files/${type}/${newFilename}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: data.content })
        });
        
        if (!saveResponse.ok) {
            throw new Error('保存新文件失败');
        }
        
        // 删除旧文件
        const deleteResponse = await fetch(`/api/projects/${currentProject}/files/${type}/${oldFilename}`, {
            method: 'DELETE'
        });
        
        if (!deleteResponse.ok) {
            throw new Error('删除旧文件失败');
        }
        
        alert('✅ 文件重命名成功！');
        await loadOverview();
        
    } catch (error) {
        console.error('重命名文件失败:', error);
        alert('❌ 重命名失败: ' + error.message);
    }
}

async function viewFile(type, filename) {
    try {
        const tabId = `${type}/${filename}`;
        
        // 如果标签已经打开，直接切换
        if (openTabs.has(tabId)) {
            switchTab(tabId);
            return;
        }
        
        // 读取文件内容
        const response = await fetch(`/api/projects/${currentProject}/files/${type}/${filename}`);
        const data = await response.json();
        
        if (data.success) {
            // 添加新标签
            openTabs.set(tabId, {
                type,
                filename,
                content: data.content,
                modified: false
            });
            
            // 创建标签 UI
            addTab(tabId, filename);
            
            // 切换到新标签
            switchTab(tabId);
            
            // 移动端自动关闭侧边栏
            if (window.innerWidth < 768) {
                closeSidebar();
            }
        }
    } catch (error) {
        console.error('读取文件失败:', error);
        alert('读取文件失败：' + error.message);
    }
}

// 添加标签页
function addTab(tabId, filename) {
    const tab = document.createElement('div');
    tab.className = 'preview-tab';
    tab.dataset.tabId = tabId;
    
    const tabName = document.createElement('span');
    tabName.className = 'tab-name';
    tabName.textContent = filename;
    tabName.title = filename;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.textContent = '×';
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        closeTab(tabId);
    };
    
    tab.appendChild(tabName);
    tab.appendChild(closeBtn);
    
    tab.onclick = () => switchTab(tabId);
    
    tabList.appendChild(tab);
}

// 切换标签
function switchTab(tabId) {
    const tabData = openTabs.get(tabId);
    if (!tabData) return;
    
    // 更新活动标签
    activeTabId = tabId;
    
    // 更新 UI
    document.querySelectorAll('.preview-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tabId === tabId);
    });
    
    // 更新当前预览文件
    currentPreviewFile = {
        type: tabData.type,
        filename: tabData.filename,
        content: tabData.content
    };
    
    // 隐藏欢迎页面
    const welcomeDiv = filePreviewContent.querySelector('.preview-welcome');
    if (welcomeDiv) welcomeDiv.style.display = 'none';
    
    // 显示普通预览
    diffPreview.style.display = 'none';
    normalPreview.style.display = 'block';
    filePreviewActions.style.display = 'none';
    
    // 显示保存按钮
    savePreviewBtn.style.display = 'inline-block';
    
    // 设置编辑器内容
    filePreviewEditor.value = tabData.content;
}

// 关闭标签
function closeTab(tabId) {
    const tabData = openTabs.get(tabId);
    
    // 如果文件已修改，提示保存
    if (tabData && tabData.modified) {
        if (!confirm(`文件"${tabData.filename}"已修改，确定关闭吗？`)) {
            return;
        }
    }
    
    // 删除标签数据
    openTabs.delete(tabId);
    
    // 删除标签 UI
    const tab = tabList.querySelector(`[data-tab-id="${tabId}"]`);
    if (tab) tab.remove();
    
    // 如果关闭的是活动标签，切换到另一个标签
    if (activeTabId === tabId) {
        if (openTabs.size > 0) {
            const nextTabId = Array.from(openTabs.keys())[0];
            switchTab(nextTabId);
        } else {
            // 没有打开的标签了，显示欢迎页面
            activeTabId = null;
            currentPreviewFile = { type: null, filename: null, content: null };
            normalPreview.style.display = 'none';
            savePreviewBtn.style.display = 'none';
            const welcomeDiv = filePreviewContent.querySelector('.preview-welcome');
            if (welcomeDiv) welcomeDiv.style.display = 'flex';
        }
    }
}

// 保存编辑后的文件（模态框）
async function saveEditedFile() {
    if (!currentEditingFile.type || !currentEditingFile.filename) {
        alert('没有正在编辑的文件');
        return;
    }
    
    try {
        const content = fileEditorContent.value;
        
        const response = await fetch(
            `/api/projects/${currentProject}/files/${currentEditingFile.type}/${currentEditingFile.filename}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            }
        );
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ 文件已保存');
            // 关闭编辑器
            fileEditorModal.classList.remove('show');
            // 重新加载概览和文件树
            await loadOverview();
            // 🔥 刷新该文件所在的文件夹
            await refreshFileFolder(currentEditingFile.type);
        } else {
            alert('保存失败：' + data.error);
        }
    } catch (error) {
        console.error('保存文件失败:', error);
        alert('保存失败：' + error.message);
    }
}

// 保存预览区域的文件
async function savePreviewFile() {
    if (!activeTabId) {
        alert('没有打开的文件');
        return;
    }
    
    const tabData = openTabs.get(activeTabId);
    if (!tabData) return;
    
    try {
        const content = filePreviewEditor.value;
        
        const response = await fetch(
            `/api/projects/${currentProject}/files/${tabData.type}/${tabData.filename}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            }
        );
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ 文件已保存');
            
            // 更新标签数据
            tabData.content = content;
            tabData.modified = false;
            
            // 移除修改标记
            const tab = tabList.querySelector(`[data-tab-id="${activeTabId}"]`);
            if (tab) tab.classList.remove('modified');
            
            // 重新加载概览和文件树
            await loadOverview();
            // 🔥 刷新该文件所在的文件夹
            await refreshFileFolder(tabData.type);
        } else {
            alert('保存失败：' + data.error);
        }
    } catch (error) {
        console.error('保存文件失败:', error);
        alert('保存失败：' + error.message);
    }
}

// 监听编辑器内容变化，标记文件已修改
if (filePreviewEditor) {
    filePreviewEditor.addEventListener('input', () => {
        if (!activeTabId) return;
        
        const tabData = openTabs.get(activeTabId);
        if (!tabData) return;
        
        // 检查内容是否与原始内容不同
        const currentContent = filePreviewEditor.value;
        const isModified = currentContent !== tabData.content;
        
        // 更新修改状态
        if (tabData.modified !== isModified) {
            tabData.modified = isModified;
            const tab = tabList.querySelector(`[data-tab-id="${activeTabId}"]`);
            if (tab) {
                tab.classList.toggle('modified', isModified);
            }
        }
    });
}

// 创建新文件
async function createNewFile() {
    const type = newFileType.value;
    const filename = newFileName.value.trim();
    
    if (!filename) {
        newFileName.style.borderColor = '#e74c3c';
        newFileName.placeholder = '⚠️ 请输入文件名';
        setTimeout(() => {
            newFileName.style.borderColor = '';
            newFileName.placeholder = '输入文件名（不含扩展名）';
        }, 2000);
        return;
    }
    
    try {
        const response = await fetch(
            `/api/projects/${currentProject}/files/${type}/${filename}.md`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: `# ${filename}\n\n创建于 ${new Date().toLocaleString('zh-CN')}` })
            }
        );
        
        const data = await response.json();
        
        if (data.success) {
            // 成功，关闭弹窗
            newFileModal.classList.remove('show');
            newFileName.value = '';
            // 重新加载文件树
            await loadOverview();
        } else {
            console.error('创建失败:', data.error);
            newFileName.style.borderColor = '#e74c3c';
        }
    } catch (error) {
        console.error('创建文件失败:', error);
        newFileName.style.borderColor = '#e74c3c';
    }
}

// 删除文件
async function deleteFile(type, filename) {
    if (!confirm(`确定要删除文件"${filename}"吗？此操作不可恢复！`)) {
        return;
    }
    
    try {
        const response = await fetch(
            `/api/projects/${currentProject}/files/${type}/${filename}`,
            {
                method: 'DELETE'
            }
        );
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ 文件已删除');
            // 重新加载概览和文件树
            await loadOverview();
        } else {
            alert('删除失败：' + data.error);
        }
    } catch (error) {
        console.error('删除文件失败:', error);
        alert('删除失败：' + error.message);
    }
}

// ==================== Diff 相关功能 ====================

// 显示文件 Diff（AI 修改后调用）
function showFileDiff(type, filename, oldContent, newContent) {
    const tabId = `${type}/${filename}`;
    
    // 保存待确认的修改
    pendingChanges = {
        type,
        filename,
        oldContent,
        newContent
    };
    
    // 如果标签已打开，切换到该标签
    if (openTabs.has(tabId)) {
        // 更新标签数据
        const tabData = openTabs.get(tabId);
        tabData.content = newContent; // 暂存新内容
        
        switchTab(tabId);
    } else {
        // 创建新标签
        openTabs.set(tabId, {
            type,
            filename,
            content: newContent,
            modified: false
        });
        
        addTab(tabId, filename);
        activeTabId = tabId;
        
        // 更新 UI
        document.querySelectorAll('.preview-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tabId === tabId);
        });
    }
    
    // 隐藏欢迎页面和普通预览
    const welcomeDiv = filePreviewContent.querySelector('.preview-welcome');
    if (welcomeDiv) welcomeDiv.style.display = 'none';
    normalPreview.style.display = 'none';
    
    // 隐藏保存按钮，显示接受/拒绝按钮
    savePreviewBtn.style.display = 'none';
    
    // 显示 Diff 视图
    diffPreview.style.display = 'block';
    filePreviewActions.style.display = 'flex';
    
    // 生成 Diff
    const diffString = createUnifiedDiff(oldContent, newContent, filename);
    
    // 使用 Diff2Html 渲染
    const targetElement = document.getElementById('diffPreview');
    const configuration = {
        drawFileList: false,
        matching: 'lines',
        outputFormat: 'side-by-side',
        highlight: true
    };
    
    const diff2htmlUi = new Diff2HtmlUI(targetElement, diffString, configuration);
    diff2htmlUi.draw();
}

// 创建 Unified Diff 格式
function createUnifiedDiff(oldContent, newContent, filename) {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    let diff = `--- a/${filename}\n+++ b/${filename}\n`;
    diff += `@@ -1,${oldLines.length} +1,${newLines.length} @@\n`;
    
    // 简单的逐行对比
    const maxLen = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLen; i++) {
        const oldLine = oldLines[i] || '';
        const newLine = newLines[i] || '';
        
        if (oldLine === newLine) {
            diff += ` ${oldLine}\n`;
        } else {
            if (i < oldLines.length) {
                diff += `-${oldLine}\n`;
            }
            if (i < newLines.length) {
                diff += `+${newLine}\n`;
            }
        }
    }
    
    return diff;
}

// 接受 AI 的修改
async function acceptFileChanges() {
    if (!pendingChanges.type || !pendingChanges.filename) {
        alert('没有待确认的修改');
        return;
    }
    
    try {
        const response = await fetch(
            `/api/projects/${currentProject}/files/${pendingChanges.type}/${pendingChanges.filename}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: pendingChanges.newContent })
            }
        );
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ 修改已应用');
            
            // 更新标签数据
            const tabId = `${pendingChanges.type}/${pendingChanges.filename}`;
            if (openTabs.has(tabId)) {
                const tabData = openTabs.get(tabId);
                tabData.content = pendingChanges.newContent;
                tabData.modified = false;
                
                const tab = tabList.querySelector(`[data-tab-id="${tabId}"]`);
                if (tab) tab.classList.remove('modified');
            }
            
            // 清空待确认修改
            pendingChanges = { type: null, filename: null, oldContent: null, newContent: null };
            
            // 切换回普通预览
            if (activeTabId) {
                switchTab(activeTabId);
            }
            
            // 重新加载文件树
            await loadOverview();
            // 🔥 刷新该文件所在的文件夹
            await refreshFileFolder(pendingChanges.type);
        } else {
            alert('应用修改失败：' + data.error);
        }
    } catch (error) {
        console.error('应用修改失败:', error);
        alert('应用修改失败：' + error.message);
    }
}

// 拒绝 AI 的修改
function rejectFileChanges() {
    if (!pendingChanges.type || !pendingChanges.filename) {
        alert('没有待确认的修改');
        return;
    }
    
    // 恢复标签到原始内容
    const tabId = `${pendingChanges.type}/${pendingChanges.filename}`;
    if (openTabs.has(tabId)) {
        const tabData = openTabs.get(tabId);
        tabData.content = pendingChanges.oldContent; // 恢复到旧内容
        tabData.modified = false;
        
        const tab = tabList.querySelector(`[data-tab-id="${tabId}"]`);
        if (tab) tab.classList.remove('modified');
        
        // 切换回普通预览
        switchTab(tabId);
    }
    
    // 清空待确认修改
    pendingChanges = { type: null, filename: null, oldContent: null, newContent: null };
    
    alert('❌ 已拒绝修改');
}

// 创建新项目
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
            newProjectModal.classList.remove('show');
            newProjectName.value = '';
            await loadProjects();
            projectSelect.value = name;
            await onProjectChange();
        } else {
            alert('创建失败: ' + data.error);
        }
    } catch (error) {
        console.error('创建项目失败:', error);
        alert('创建失败');
    }
}

// 发送消息
async function sendMessage() {
    if (!currentProject) {
        alert('请先选择一个项目');
        return;
    }
    
    const message = chatInput.value.trim();
    if (!message || isGenerating) return;
    
    // 构建完整的提示词（只传递文件引用信息，不传内容）
    let fullPrompt = message;
    let fileReferences = [];  // 保存文件引用元数据
    
    if (referencedFiles.length > 0) {
        // 分离项目文件和上传文件
        const projectFiles = referencedFiles.filter(ref => ref.type === 'project');
        const uploadFiles = referencedFiles.filter(ref => ref.type === 'upload');
        
        fullPrompt = '';
        
        // 项目文件：只传引用路径
        if (projectFiles.length > 0) {
            fullPrompt += '【用户引用的项目文件】\n\n';
            projectFiles.forEach(ref => {
                fullPrompt += `- @${ref.title} (路径: ${ref.source})\n`;
            });
            fullPrompt += `\n💡 提示：使用 read_file 工具读取这些文件的内容。\n\n`;
        }
        
        // 上传文件：传完整内容（因为不在项目中）
        if (uploadFiles.length > 0) {
            fullPrompt += '【用户上传的文件内容】\n\n';
            uploadFiles.forEach(ref => {
                fullPrompt += `## 文件: ${ref.title}\n\`\`\`\n${ref.content}\n\`\`\`\n\n`;
            });
        }
        
        fullPrompt += `【用户问题】\n${message}`;
    }
    
    // 添加用户消息（显示原始消息 + 文件引用标签）
    let displayMessage = message;
    if (referencedFiles.length > 0) {
        const refTags = referencedFiles.map(ref => `@${ref.title}`).join(' ');
        displayMessage = `${refTags}\n\n${message}`;
    }
    addMessage('user', displayMessage);
    chatInput.value = '';
    
    // 清空引用（发送后清空）
    clearAllReferences();
    
    // 禁用输入，启用终止，显示 loading
    console.log('🚀 开始发送消息，准备接收流式响应');
    isGenerating = true;
    loadingIndicator.style.display = 'flex';
    sendBtn.disabled = false; // 保持启用以便点击终止
    sendBtn.querySelector('span:first-child').style.display = 'none';
    sendBtn.querySelector('.loading').textContent = '⏹ 终止';
    sendBtn.querySelector('.loading').style.display = 'inline';
    sendBtn.classList.add('btn-stop');
    
    // 🔥 添加全局错误监听
    window.addEventListener('error', (e) => {
        console.error('⚠️ 全局错误:', e.error);
    }, { once: true });
    
    // 使用 EventSource 接收流式输出
    try {
        const response = await fetch(`/api/projects/${currentProject}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: fullPrompt,           // 完整提示（包含文件引用信息，用于 AI 处理）
                originalMessage: message      // 🔥 原始消息（只保存这个到对话历史）
            })
        });
        
        // 🔥 检查响应状态
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`服务器错误 (${response.status}): ${errorText}`);
        }
        
        // 🔥 检查 Content-Type
        const contentType = response.headers.get('Content-Type');
        if (!contentType || !contentType.includes('text/event-stream')) {
            console.warn(`⚠️ 意外的 Content-Type: ${contentType}`);
        }
        
        currentReader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = null;
        let buffer = '';
        
        console.log('🔄 开始读取流式响应...');
        
        // 🔥 添加异常中止检测
        let readCount = 0;
        
        while (true) {
            let value;
            try {
                const result = await currentReader.read();
                readCount++;
                
                if (result.done) {
                    console.log(`✅ 流式读取完成（共读取 ${readCount} 次）`);
                    break;
                }
                
                value = result.value;
            } catch (readError) {
                console.error('❌ 读取流时发生错误:', readError);
                throw readError;
            }
            
            const chunk = decoder.decode(value, { stream: true });
            
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 保留不完整的行
            
            for (const line of lines) {
                // 跳过空行和注释行（SSE 心跳）
                if (!line.trim() || line.startsWith(':')) {
                    continue;
                }
                
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.substring(6));
                    
                    // 🔥 处理连接和初始化信号
                    if (data.type === 'connected' || data.type === 'initializing') {
                        console.log(`📡 ${data.type}: ${data.data}`);
                        continue;
                    }
                    
                    if (data.type === 'start') {
                        // 创建新的 AI 消息（带实时思考区域和最终答案区域）
                        assistantMessage = addMessage('assistant', '');
                        const content = assistantMessage.querySelector('.message-content');
                        content.innerHTML = `
                            <div class="thinking-toggle" style="cursor: pointer; color: #666; font-size: 12px; margin-bottom: 5px; user-select: none;">
                                <span>▼ 思考过程</span>
                            </div>
                            <div class="thinking-process" style="background: #f5f5f5; padding: 10px; border-radius: 5px; margin-bottom: 10px; font-family: monospace; white-space: pre-wrap; font-size: 11px; max-height: 400px; overflow-y: auto; line-height: 1.5;"></div>
                            <div class="thinking-loading" style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; color: #999; font-size: 13px;">
                                <div class="loading-spinner" style="width: 16px; height: 16px; border: 2px solid #e0e0e0; border-top-color: #667eea; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                                <span>AI 正在思考中...</span>
                            </div>
                            <div class="final-answer" style="margin-top: 10px;"></div>
                        `;
                        
                        // 添加折叠功能
                        const toggle = content.querySelector('.thinking-toggle');
                        const thinkingDiv = content.querySelector('.thinking-process');
                        toggle.addEventListener('click', () => {
                            if (thinkingDiv.style.display === 'none') {
                                thinkingDiv.style.display = 'block';
                                toggle.querySelector('span').textContent = '▼ 思考过程';
                            } else {
                                thinkingDiv.style.display = 'none';
                                toggle.querySelector('span').textContent = '▶ 思考过程';
                            }
                        });
                    } else if (data.type === 'llm_stream') {
                        // 🔥 LLM 流式输出：逐字显示当前轮的思考
                        if (assistantMessage) {
                            const thinkingDiv = assistantMessage.querySelector('.thinking-process');
                            if (thinkingDiv) {
                                // 提取当前轮次的内容（最后一个分隔符之后的部分）
                                const sections = thinkingDiv.textContent.split('==================================================');
                                if (sections.length > 0) {
                                    // 保留之前的轮次，更新当前轮次
                                    sections[sections.length - 1] = '\n' + data.data;
                                    thinkingDiv.textContent = sections.join('==================================================');
                                } else {
                                    thinkingDiv.textContent = data.data;
                                }
                                // 自动滚动到底部
                                thinkingDiv.scrollTop = thinkingDiv.scrollHeight;
                            }
                        }
                    } else if (data.type === 'iteration_start') {
                        // 🔥 新的迭代开始：添加分隔符
                        if (assistantMessage) {
                            const thinkingDiv = assistantMessage.querySelector('.thinking-process');
                            if (thinkingDiv) {
                                const separator = '\n' + '='.repeat(50) + '\n' + data.message + '\n' + '='.repeat(50) + '\n';
                                thinkingDiv.textContent += separator;
                                thinkingDiv.scrollTop = thinkingDiv.scrollHeight;
                            }
                        }
                    } else if (data.type === 'progress') {
                        // 🔥 其他进度更新：累积显示完整历史
                        if (assistantMessage) {
                            const thinkingDiv = assistantMessage.querySelector('.thinking-process');
                            if (thinkingDiv) {
                                thinkingDiv.textContent = data.data;
                                thinkingDiv.scrollTop = thinkingDiv.scrollHeight;
                            }
                        } else {
                            assistantMessage = addMessage('assistant', data.data);
                        }
                    } else if (data.type === 'thinking') {
                        // 旧的思考状态（兼容）
                        if (assistantMessage) {
                            const thinkingDiv = assistantMessage.querySelector('.thinking-process');
                            if (thinkingDiv) {
                                thinkingDiv.textContent = data.data;
                            }
                        }
                    } else if (data.type === 'content') {
                        // 更新最终答案（Markdown 渲染）
                        if (assistantMessage) {
                            const finalAnswer = assistantMessage.querySelector('.final-answer');
                            if (finalAnswer) {
                                finalAnswer.innerHTML = marked.parse(data.data);
                            } else {
                                const content = assistantMessage.querySelector('.message-content');
                                content.innerHTML = marked.parse(data.data);
                            }
                        }
                    } else if (data.type === 'file_update') {
                        // 🔥 AI 更新文件：显示 Diff
                        const { type, filename, oldContent, newContent } = data.data;
                        showFileDiff(type, filename, oldContent, newContent);
                        // 🔥 自动刷新文件列表
                        await refreshFileFolder(type);
                    } else if (data.type === 'done') {
                        // 完成 - 隐藏 loading 状态
                        if (assistantMessage) {
                            const loadingDiv = assistantMessage.querySelector('.thinking-loading');
                            if (loadingDiv) {
                                loadingDiv.style.display = 'none';
                            }
                        }
                        await loadOverview();
                        // 🔥 完成后也刷新文件列表
                        await refreshAllFileFolders();
                    } else if (data.type === 'error') {
                        // 错误 - 隐藏 loading 状态
                        if (assistantMessage) {
                            const loadingDiv = assistantMessage.querySelector('.thinking-loading');
                            if (loadingDiv) {
                                loadingDiv.style.display = 'none';
                            }
                            const content = assistantMessage.querySelector('.message-content');
                            content.innerHTML = `❌ 错误: ${data.data}`;
                        } else {
                            addMessage('assistant', `❌ 错误: ${data.data}`);
                        }
                    }
                    } catch (parseError) {
                        console.error('解析 SSE 数据失败:', line, parseError);
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ 发送消息失败:', error);
        console.error('错误堆栈:', error.stack);
        addMessage('assistant', `❌ 错误: ${error.message}`);
    } finally {
        // 恢复输入，隐藏 loading
        console.log('🏁 流式响应结束，恢复UI状态');
        isGenerating = false;
        loadingIndicator.style.display = 'none';
        currentReader = null;
        sendBtn.disabled = false;
        sendBtn.querySelector('span:first-child').style.display = 'inline';
        sendBtn.querySelector('.loading').style.display = 'none';
        sendBtn.classList.remove('btn-stop');
        
        // 🔥 不要在这里重新加载历史，因为会清空正在显示的消息
        // 删除按钮将在下次加载时显示
        console.log('✅ 流式响应处理完成');
    }
}

// 终止生成
async function stopGenerating() {
    console.log('🛑 用户手动终止生成');
    
    // 🔥 发送停止请求到后端
    try {
        const stopResponse = await fetch(`/api/projects/${currentProject}/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const stopResult = await stopResponse.json();
        console.log('📡 停止请求已发送:', stopResult.message);
    } catch (error) {
        console.error('❌ 发送停止请求失败:', error);
    }
    
    // 取消前端的 stream 读取
    if (currentReader) {
        currentReader.cancel();
        currentReader = null;
    }
    
    // 移除思考过程的 loading 状态
    if (assistantMessage) {
        const loadingDiv = assistantMessage.querySelector('.thinking-loading');
        if (loadingDiv) {
            loadingDiv.style.display = 'none';
            console.log('✅ 已移除思考过程 loading 状态');
        }
    }
    
    isGenerating = false;
    loadingIndicator.style.display = 'none';
    sendBtn.disabled = false;
    sendBtn.querySelector('span:first-child').style.display = 'inline';
    sendBtn.querySelector('.loading').style.display = 'none';
    sendBtn.classList.remove('btn-stop');
    
    console.log('✅ 已终止 AI 输出');
}

// 添加消息到聊天
function addMessage(role, content, scrollToBottom = true, metadata = null, messageIndex = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${role}`;
    
    // 创建包装器
    const wrapperDiv = document.createElement('div');
    wrapperDiv.className = 'message-wrapper';
    
    // 添加角色标签
    const roleLabel = document.createElement('div');
    roleLabel.className = 'message-role';
    roleLabel.textContent = role === 'user' ? '👤 用户' : '🤖 AI Agent';
    wrapperDiv.appendChild(roleLabel);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (role === 'assistant') {
        contentDiv.innerHTML = marked.parse(content);
        
        // 如果有推理过程，添加折叠显示
        if (metadata && metadata.thinkingProcess) {
            const thinkingToggle = document.createElement('div');
            thinkingToggle.className = 'thinking-toggle';
            thinkingToggle.textContent = '💭 查看推理过程';
            
            const thinkingDiv = document.createElement('pre');
            thinkingDiv.className = 'thinking-process';
            thinkingDiv.style.display = 'none';
            thinkingDiv.textContent = metadata.thinkingProcess;
            
            thinkingToggle.onclick = () => {
                if (thinkingDiv.style.display === 'none') {
                    thinkingDiv.style.display = 'block';
                    thinkingToggle.textContent = '🔼 隐藏推理过程';
                } else {
                    thinkingDiv.style.display = 'none';
                    thinkingToggle.textContent = '💭 查看推理过程';
                }
            };
            
            contentDiv.appendChild(thinkingToggle);
            contentDiv.appendChild(thinkingDiv);
        }
    } else {
        contentDiv.textContent = content;
    }
    
    wrapperDiv.appendChild(contentDiv);
    
    // 添加删除按钮到包装器底部
    if (messageIndex !== null) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'message-delete-btn';
        deleteBtn.textContent = '🗑️ 删除';
        deleteBtn.title = '删除此消息';
        deleteBtn.onclick = () => deleteMessage(messageIndex);
        wrapperDiv.appendChild(deleteBtn);
    }
    
    messageDiv.appendChild(wrapperDiv);
    chatMessages.appendChild(messageDiv);
    
    // 🔥 可选滚动到底部
    if (scrollToBottom) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    return messageDiv;
}

// 清空对话历史
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
            addMessage('assistant', '✅ 对话历史已清空');
        }
    } catch (error) {
        console.error('清空历史失败:', error);
    }
}

// ==================== 文件引用功能 ====================

// 打开文件选择器
async function openFileSelector() {
    if (!currentProject) {
        alert('请先选择项目');
        return;
    }
    
    // 加载文件列表到选择器
    await loadFileSelectorTree();
    selectProjectFileModal.classList.add('show');
}

// 加载文件选择器的文件树
async function loadFileSelectorTree() {
    fileSelectorTree.innerHTML = '';
    
    const fileTypes = [
        { key: '人物设定', icon: '👤', name: '人物设定' },
        { key: '世界观设定', icon: '🌍', name: '世界观设定' },
        { key: '章节内容', icon: '📖', name: '章节内容' },
        { key: '大纲', icon: '📋', name: '大纲' },
        { key: '灵感记录', icon: '💡', name: '灵感记录' },
        { key: '设定资料', icon: '📚', name: '设定资料' },
        { key: '创作笔记', icon: '📝', name: '创作笔记' }
    ];
    
    for (const type of fileTypes) {
        try {
            const response = await fetch(`/api/projects/${currentProject}/files/${type.key}`);
            const data = await response.json();
            
            if (data.success && data.files && data.files.length > 0) {
                const folderDiv = document.createElement('div');
                folderDiv.className = 'file-selector-folder expanded';
                
                folderDiv.innerHTML = `
                    <div class="file-selector-folder-header">
                        <span class="file-selector-folder-arrow">▶</span>
                        <span>${type.icon} ${type.name}</span>
                        <span>(${data.files.length})</span>
                    </div>
                    <div class="file-selector-files"></div>
                `;
                
                const header = folderDiv.querySelector('.file-selector-folder-header');
                header.addEventListener('click', () => {
                    folderDiv.classList.toggle('expanded');
                });
                
                const filesContainer = folderDiv.querySelector('.file-selector-files');
                data.files.forEach(file => {
                    const fileDiv = document.createElement('div');
                    fileDiv.className = 'file-selector-file';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `file-${type.key}-${file.filename}`;
                    checkbox.dataset.type = type.key;
                    checkbox.dataset.filename = file.filename;
                    checkbox.dataset.title = file.title;
                    
                    const label = document.createElement('label');
                    label.htmlFor = checkbox.id;
                    label.textContent = `📄 ${file.title}`;
                    
                    fileDiv.appendChild(checkbox);
                    fileDiv.appendChild(label);
                    filesContainer.appendChild(fileDiv);
                });
                
                fileSelectorTree.appendChild(folderDiv);
            }
        } catch (error) {
            console.error(`加载文件类型 ${type.key} 失败:`, error);
        }
    }
}

// 确认文件选择
async function confirmFileSelection() {
    const checkboxes = fileSelectorTree.querySelectorAll('input[type="checkbox"]:checked');
    
    for (const checkbox of checkboxes) {
        const type = checkbox.dataset.type;
        const filename = checkbox.dataset.filename;
        const title = checkbox.dataset.title;
        
        // ✅ 只保存文件引用，不读取内容（由Agent通过工具读取）
        addReference({
            type: 'project',
            source: `${type}/${filename}`,
            title: title,
            content: null  // 不保存内容
        });
    }
    
    selectProjectFileModal.classList.remove('show');
}

// 处理文件上传
async function handleFileUpload(event) {
    const files = event.target.files;
    
    for (const file of files) {
        if (file.type === 'text/plain' || file.type === 'text/markdown' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
            try {
                const content = await file.text();
                // ⚠️ 上传文件需要保存内容（因为不在项目中，Agent无法通过工具读取）
                addReference({
                    type: 'upload',
                    source: file.name,
                    title: file.name,
                    content: content  // 上传文件保留内容
                });
            } catch (error) {
                console.error('读取文件失败:', error);
                alert(`读取文件 ${file.name} 失败`);
            }
        } else {
            alert(`不支持的文件类型: ${file.name}`);
        }
    }
    
    // 清空 input
    fileUploadInput.value = '';
}

// 添加引用
function addReference(ref) {
    // 检查是否已经引用
    const exists = referencedFiles.some(r => r.source === ref.source);
    if (exists) {
        console.log('文件已引用:', ref.title);
        return;
    }
    
    referencedFiles.push(ref);
    updateReferenceDisplay();
}

// 更新引用显示
function updateReferenceDisplay() {
    if (referencedFiles.length === 0) {
        fileReferenceArea.style.display = 'none';
        return;
    }
    
    fileReferenceArea.style.display = 'block';
    referenceList.innerHTML = '';
    
    referencedFiles.forEach((ref, index) => {
        const refDiv = document.createElement('div');
        refDiv.className = 'reference-item';
        
        const icon = ref.type === 'project' ? '📎' : '📤';
        
        refDiv.innerHTML = `
            <span class="reference-item-icon">${icon}</span>
            <span class="reference-item-name" title="${ref.source}">${ref.title}</span>
            <button class="reference-item-remove" data-index="${index}" title="移除">×</button>
        `;
        
        const removeBtn = refDiv.querySelector('.reference-item-remove');
        removeBtn.addEventListener('click', () => removeReference(index));
        
        referenceList.appendChild(refDiv);
    });
}

// 移除引用
function removeReference(index) {
    referencedFiles.splice(index, 1);
    updateReferenceDisplay();
}

// 清空所有引用
function clearAllReferences() {
    referencedFiles = [];
    updateReferenceDisplay();
}

// ==================== @ 下拉菜单功能 ====================

// 处理输入框内容变化
function handleChatInputChange(e) {
    if (!currentProject) return;
    
    const text = chatInput.value;
    const cursorPos = chatInput.selectionStart;
    
    // 检测光标前的最后一个 @ 符号
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
        
        // 如果 @ 后面没有空格或换行，显示下拉菜单
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

// 处理键盘事件
function handleChatInputKeydown(e) {
    if (!atDropdownVisible) {
        // 默认的 Enter 发送消息行为
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
        return;
    }
    
    // 下拉菜单可见时的键盘处理
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveSelection(1);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveSelection(-1);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        selectOrToggleCurrent();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        closeAtDropdown();
    }
}

// 显示下拉菜单
async function showAtDropdown(searchText = '') {
    if (!currentProject) return;
    
    atDropdownVisible = true;
    atFileDropdown.style.display = 'flex';
    
    // 加载所有文件
    await loadAllFilesForAt();
    
    // 过滤并显示
    filterAndDisplayFiles(searchText);
}

// 关闭下拉菜单
function closeAtDropdown() {
    atDropdownVisible = false;
    atFileDropdown.style.display = 'none';
    atDropdownSelectedIndex = -1;
    atStartPosition = -1;
}

// 加载所有可引用的文件（文件夹结构）
async function loadAllFilesForAt() {
    atDropdownFolders = [];
    
    const fileTypes = [
        { key: '人物设定', icon: '👤', name: '人物设定' },
        { key: '世界观设定', icon: '🌍', name: '世界观设定' },
        { key: '章节内容', icon: '📖', name: '章节内容' },
        { key: '大纲', icon: '📋', name: '大纲' },
        { key: '灵感记录', icon: '💡', name: '灵感记录' },
        { key: '设定资料', icon: '📚', name: '设定资料' },
        { key: '创作笔记', icon: '📝', name: '创作笔记' }
    ];
    
    for (const type of fileTypes) {
        try {
            const response = await fetch(`/api/projects/${currentProject}/files/${type.key}`);
            const data = await response.json();
            
            if (data.success && data.files) {
                atDropdownFolders.push({
                    type: type.key,
                    icon: type.icon,
                    name: type.name,
                    files: data.files || [],
                    expanded: false
                });
            }
        } catch (error) {
            console.error(`加载文件类型 ${type.key} 失败:`, error);
        }
    }
}

// 过滤并显示文件（树形结构）
function filterAndDisplayFiles(searchText, keepSelectedFolderIndex = null) {
    atFileList.innerHTML = '';
    atDropdownItems = [];
    
    // 如果有搜索文本，展开所有文件夹
    if (searchText) {
        atDropdownFolders.forEach(folder => folder.expanded = true);
    }
    
    let targetSelectionIndex = 0; // 要选中的项索引
    
    atDropdownFolders.forEach((folder, folderIndex) => {
        // 过滤文件
        const filteredFiles = searchText 
            ? folder.files.filter(file => file.title.toLowerCase().includes(searchText.toLowerCase()))
            : folder.files;
        
        // 如果没有匹配的文件，跳过这个文件夹
        if (searchText && filteredFiles.length === 0) return;
        
        // 创建文件夹项
        const folderDiv = document.createElement('div');
        folderDiv.className = 'at-file-folder';
        folderDiv.dataset.folderIndex = folderIndex;
        
        const arrow = folder.expanded ? '▼' : '▶';
        folderDiv.innerHTML = `
            <div class="at-file-folder-header ${folder.expanded ? 'expanded' : ''}">
                <span class="at-file-folder-arrow">${arrow}</span>
                <span class="at-file-folder-icon">${folder.icon}</span>
                <span class="at-file-folder-name">${folder.name}</span>
                <span class="at-file-folder-count">(${filteredFiles.length})</span>
            </div>
            <div class="at-file-folder-content" style="display: ${folder.expanded ? 'block' : 'none'};">
            </div>
        `;
        
        // 记录这个文件夹在导航列表中的位置
        const currentFolderItemIndex = atDropdownItems.length;
        
        // 文件夹项总是可以导航
        atDropdownItems.push({ type: 'folder', index: folderIndex, element: folderDiv, folder });
        
        // 如果这是要保持选中的文件夹
        if (keepSelectedFolderIndex === folderIndex) {
            if (folder.expanded && filteredFiles.length > 0) {
                // 展开后，选中第一个文件
                targetSelectionIndex = currentFolderItemIndex + 1;
            } else {
                // 折叠后或没有文件，选中文件夹本身
                targetSelectionIndex = currentFolderItemIndex;
            }
        }
        
        // 文件夹点击事件
        const header = folderDiv.querySelector('.at-file-folder-header');
        header.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFolder(folderIndex);
        });
        
        // 只有展开状态才添加文件到导航列表
        if (folder.expanded) {
            const contentDiv = folderDiv.querySelector('.at-file-folder-content');
            filteredFiles.forEach((file, fileIndex) => {
                const fileDiv = document.createElement('div');
                fileDiv.className = 'at-file-item';
                fileDiv.dataset.folderIndex = folderIndex;
                fileDiv.dataset.fileIndex = fileIndex;
                
                fileDiv.innerHTML = `
                    <span class="at-file-item-icon">📄</span>
                    <div class="at-file-item-info">
                        <div class="at-file-item-title">${file.title}</div>
                    </div>
                `;
                
                fileDiv.addEventListener('click', () => selectFileFromFolder(folder, file));
                contentDiv.appendChild(fileDiv);
                
                // 文件项可以导航（只有展开时）
                atDropdownItems.push({ type: 'file', folderIndex, fileIndex, element: fileDiv, folder, file });
            });
        }
        
        atFileList.appendChild(folderDiv);
    });
    
    if (atDropdownItems.length === 0) {
        atFileList.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">未找到匹配的文件</div>';
        return;
    }
    
    // 选中目标项（如果指定了要保持的文件夹，则选中计算的位置；否则选中第一个）
    atDropdownSelectedIndex = targetSelectionIndex;
    updateSelection();
}

// 展开/折叠文件夹
function toggleFolder(folderIndex) {
    const wasExpanded = atDropdownFolders[folderIndex].expanded;
    atDropdownFolders[folderIndex].expanded = !wasExpanded;
    
    // 记住当前要保持选中的文件夹
    const targetFolderIndex = folderIndex;
    
    filterAndDisplayFiles(atFileSearchInput.value, targetFolderIndex);
}

// 移动选择
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

// 更新选中状态
function updateSelection() {
    atDropdownItems.forEach((item, index) => {
        const element = item.type === 'folder' 
            ? item.element.querySelector('.at-file-folder-header')
            : item.element;
        
        if (index === atDropdownSelectedIndex) {
            element.classList.add('selected');
            element.scrollIntoView({ block: 'nearest' });
        } else {
            element.classList.remove('selected');
        }
    });
}

// 选择或展开当前项
function selectOrToggleCurrent() {
    if (atDropdownSelectedIndex < 0 || atDropdownSelectedIndex >= atDropdownItems.length) return;
    
    const currentItem = atDropdownItems[atDropdownSelectedIndex];
    
    if (currentItem.type === 'folder') {
        // 展开/折叠文件夹
        toggleFolder(currentItem.index);
    } else if (currentItem.type === 'file') {
        // 选择文件
        selectFileFromFolder(currentItem.folder, currentItem.file);
    }
}

// 从文件夹选择文件
async function selectFileFromFolder(folder, file) {
    // ✅ 只保存文件引用，不读取内容（由Agent通过工具读取）
    addReference({
        type: 'project',
        source: `${folder.type}/${file.filename}`,
        title: file.title,
        content: null  // 不保存内容
    });
    
    // 如果是通过 @ 触发的，替换输入框中的 @
    if (atStartPosition >= 0) {
        const text = chatInput.value;
        const before = text.substring(0, atStartPosition);
        const after = text.substring(chatInput.selectionStart);
        chatInput.value = before + `@${file.title} ` + after;
        
        // 设置光标位置
        const newPos = before.length + file.title.length + 2;
        chatInput.setSelectionRange(newPos, newPos);
        chatInput.focus();
    }
    
    closeAtDropdown();
}

// 处理搜索输入
function handleAtSearchInput(e) {
    const searchText = e.target.value;
    filterAndDisplayFiles(searchText);
}

// ==================== 提示词设置功能 ====================

const promptSettingsBtn = document.getElementById('promptSettingsBtn');
const promptSettingsModal = document.getElementById('promptSettingsModal');
const closePromptSettingsModal = document.getElementById('closePromptSettingsModal');
const projectPromptEditor = document.getElementById('projectPromptEditor');
const systemPromptEditor = document.getElementById('systemPromptEditor');
const saveProjectPromptBtn = document.getElementById('saveProjectPromptBtn');
const saveSystemPromptBtn = document.getElementById('saveSystemPromptBtn');
const promptTabButtons = document.querySelectorAll('.prompt-tab');

let currentPromptTab = 'project';

// 打开提示词设置
promptSettingsBtn.addEventListener('click', () => {
    if (!currentProject) {
        alert('请先选择或创建一个项目');
        return;
    }
    
    promptSettingsModal.style.display = 'flex';
    loadPrompts();
});

// 关闭模态框
closePromptSettingsModal.addEventListener('click', () => {
    promptSettingsModal.style.display = 'none';
});

// 点击模态框外部关闭
promptSettingsModal.addEventListener('click', (e) => {
    if (e.target === promptSettingsModal) {
        promptSettingsModal.style.display = 'none';
    }
});

// Tab 切换
promptTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        switchPromptTab(tabName);
    });
});

function switchPromptTab(tabName) {
    currentPromptTab = tabName;
    
    // 更新 Tab 按钮状态
    promptTabButtons.forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // 更新内容显示
    document.getElementById('projectPromptTab').classList.toggle('active', tabName === 'project');
    document.getElementById('systemPromptTab').classList.toggle('active', tabName === 'system');
}

// 加载提示词
async function loadPrompts() {
    try {
        // 加载项目提示词
        const projectResponse = await fetch(`/api/projects/${currentProject}/prompts/project`);
        if (projectResponse.ok) {
            const projectData = await projectResponse.json();
            projectPromptEditor.value = projectData.content;
        } else {
            projectPromptEditor.value = '# 创作提示词知识库\n\n（文件不存在，保存后将自动创建）';
        }
        
        // 加载系统提示词
        const systemResponse = await fetch('/api/prompts/system');
        if (systemResponse.ok) {
            const systemData = await systemResponse.json();
            systemPromptEditor.value = systemData.content;
        } else {
            systemPromptEditor.value = '（系统提示词文件不存在）';
        }
    } catch (error) {
        console.error('加载提示词失败:', error);
        alert('加载提示词失败: ' + error.message);
    }
}

// 保存项目提示词
saveProjectPromptBtn.addEventListener('click', async () => {
    try {
        const content = projectPromptEditor.value;
        
        const response = await fetch(`/api/projects/${currentProject}/prompts/project`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ 项目提示词已保存！');
            // 刷新文件列表
            await loadOverview();
        } else {
            alert('❌ 保存失败: ' + data.error);
        }
    } catch (error) {
        console.error('保存项目提示词失败:', error);
        alert('保存失败: ' + error.message);
    }
});

// 保存系统提示词
saveSystemPromptBtn.addEventListener('click', async () => {
    try {
        const content = systemPromptEditor.value;
        
        const confirmed = confirm(
            '⚠️ 警告：修改系统提示词会影响所有项目的AI行为。\n\n确定要保存吗？'
        );
        
        if (!confirmed) {
            return;
        }
        
        const response = await fetch('/api/prompts/system', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ 系统提示词已保存！\n\n建议刷新页面以使更改生效。');
        } else {
            alert('❌ 保存失败: ' + data.error);
        }
    } catch (error) {
        console.error('保存系统提示词失败:', error);
        alert('保存失败: ' + error.message);
    }
});

// 启动应用
init();

