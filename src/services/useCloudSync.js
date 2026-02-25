import { ref } from 'vue';
import backendApi from './backend';

export function useCloudSync() {
    const isSyncing = ref(false);
    const syncError = ref(null);

    /**
     * Fetch all user data (novels, prompts, config) from the backend
     * and populate localStorage so existing components can continue to function
     * seamlessly without a massive refactor right away.
     */
    const fetchAllData = async () => {
        isSyncing.value = true;
        syncError.value = null;

        try {
            // 1. Fetch Novels
            const novelsRes = await backendApi.get('/api/novels');
            const backendNovels = novelsRes.data;

            const parsedNovels = backendNovels.map(novel => {
                let complexData = {
                    characters: [],
                    worldSettings: [],
                    corpusData: [],
                    events: []
                };

                if (novel.tags) {
                    try {
                        complexData = JSON.parse(novel.tags);
                    } catch (e) {
                        console.warn("Could not parse tags for novel", novel.id);
                    }
                }

                return {
                    ...novel,
                    ...complexData,
                    chapterList: novel.chapters || [],
                    tags: null
                };
            });
            localStorage.setItem('novels', JSON.stringify(parsedNovels));

            // 2. Fetch Prompts
            const promptsRes = await backendApi.get('/api/prompts');
            localStorage.setItem('prompts', JSON.stringify(promptsRes.data));

            // 3. Fetch Configs
            const configsRes = await backendApi.get('/api/configs');
            const configs = configsRes.data;
            configs.forEach(cfg => {
                // Restore all keys like writingGoals, novelGenres, shortStoryConfig, etc.
                localStorage.setItem(cfg.key, cfg.value);
            });

            return true;
        } catch (err) {
            console.error('Initial data sync failed:', err);
            syncError.value = '云端数据同步失败';
            return false;
        } finally {
            isSyncing.value = false;
        }
    };

    /**
     * Save a single novel to the backend
     */
    const saveNovel = async (novelData) => {
        try {
            const isLocalOnly = typeof novelData.id === 'number' || !novelData.id;
            const payload = {
                title: novelData.title,
                description: novelData.description || '',
                cover: novelData.cover || '',
                author: novelData.author || '',
                status: novelData.status || 'draft',
                tags: JSON.stringify({
                    characters: novelData.characters || [],
                    worldSettings: novelData.worldSettings || [],
                    corpusData: novelData.corpusData || [],
                    events: novelData.events || []
                })
            };

            let savedNovel;
            if (isLocalOnly) {
                const res = await backendApi.post('/api/novels', payload);
                savedNovel = res.data;
            } else {
                const res = await backendApi.put(`/api/novels/${novelData.id}`, payload);
                savedNovel = res.data;
            }

            // Sync chapters (simplified for background sync)
            if (novelData.chapterList && Array.isArray(novelData.chapterList)) {
                for (const chapter of novelData.chapterList) {
                    const chPayload = {
                        title: chapter.title,
                        content: chapter.content || '',
                        wordCount: chapter.wordCount || 0,
                        status: chapter.status || 'draft',
                        order: chapter.order || 0
                    };

                    if (typeof chapter.id === 'number' || !chapter.id) {
                        chPayload.novelId = savedNovel.id;
                        await backendApi.post('/api/chapters', chPayload);
                    } else {
                        await backendApi.put(`/api/chapters/${chapter.id}`, chPayload);
                    }
                }
            }
            return true;
        } catch (err) {
            console.error('Failed to save novel to cloud', err);
            return false;
        }
    };

    /**
     * Save a single prompt to the backend
     */
    const savePrompt = async (promptData) => {
        try {
            const isLocalOnly = typeof promptData.id === 'number' || !promptData.id;
            const payload = {
                name: promptData.name || promptData.title,
                content: promptData.content,
                category: promptData.category || 'default',
                tags: typeof promptData.tags === 'string' ? promptData.tags : JSON.stringify(promptData.tags || [])
            };

            if (isLocalOnly) {
                await backendApi.post('/api/prompts', payload);
            } else {
                await backendApi.put(`/api/prompts/${promptData.id}`, payload);
            }
            return true;
        } catch (err) {
            console.error('Failed to save prompt to cloud', err);
            return false;
        }
    };

    /**
     * Save a generic config key-value pair to the backend
     */
    const saveConfig = async (key, value) => {
        try {
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            await backendApi.post('/api/configs', { key, value: stringValue });
            return true;
        } catch (err) {
            console.error(`Failed to save config ${key} to cloud`, err);
            return false;
        }
    };

    /**
     * Delete a prompt from the backend
     */
    const deletePrompt = async (promptId) => {
        try {
            if (typeof promptId !== 'number') {
                await backendApi.delete(`/api/prompts/${promptId}`);
            }
            return true;
        } catch (err) {
            console.error('Failed to delete prompt from cloud', err);
            return false;
        }
    };

    /**
     * Delete a novel from the backend
     */
    const deleteNovel = async (novelId) => {
        try {
            if (typeof novelId !== 'number') {
                await backendApi.delete(`/api/novels/${novelId}`);
            }
            return true;
        } catch (err) {
            console.error('Failed to delete novel from cloud', err);
            return false;
        }
    };

    /**
     * Delete a chapter from the backend
     */
    const deleteChapter = async (chapterId) => {
        try {
            if (typeof chapterId !== 'number') {
                await backendApi.delete(`/api/chapters/${chapterId}`);
            }
            return true;
        } catch (err) {
            console.error('Failed to delete chapter from cloud', err);
            return false;
        }
    };

    return {
        isSyncing,
        syncError,
        fetchAllData,
        saveNovel,
        savePrompt,
        deletePrompt,
        deleteNovel,
        deleteChapter,
        saveConfig
    };
}
