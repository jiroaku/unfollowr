// ===== BACKGROUND SCRIPT FOR TWITCH UNFOLLOW PRO =====
// Handles extension icon clicks and tab management

class BackgroundManager {
    constructor() {
        this.setupEventListeners();
        console.log('🚀 Twitch Unfollow Pro: Background script initialized');
    }

    setupEventListeners() {
        // Listen for extension icon clicks
        chrome.action.onClicked.addListener(async (tab) => {
            await this.handleExtensionClick(tab);
        });

        // Listen for messages from content scripts
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });

        // Listen for tab updates
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdate(tabId, changeInfo, tab);
        });
    }

    async handleExtensionClick(tab) {
        try {
            console.log('🎯 Extension icon clicked, opening Twitch following page...');
            
            // Check if user is already on Twitch following page
            if (tab.url && tab.url.includes('twitch.tv/directory/following/channels')) {
                console.log('🎯 Already on following page, injecting interface...');
                await this.injectInterface(tab.id);
                return;
            }

            // Open Twitch following page in new tab
            const newTab = await chrome.tabs.create({
                url: 'https://www.twitch.tv/directory/following/channels',
                active: true
            });

            console.log('🎯 Opened new tab:', newTab.id);

        } catch (error) {
            console.error('❌ Error handling extension click:', error);
        }
    }

    async handleTabUpdate(tabId, changeInfo, tab) {
        // Only process when page is complete and it's a Twitch following page
        if (changeInfo.status === 'complete' && 
            tab.url && 
            tab.url.includes('twitch.tv/directory/following/channels')) {
            
            console.log('🎯 Twitch following page loaded, injecting interface...');
            
            try {
                await this.injectInterface(tabId);
            } catch (error) {
                console.error('❌ Error injecting interface:', error);
            }
        }
    }

    async injectInterface(tabId) {
        try {
            // Inject CSS first
            await chrome.scripting.insertCSS({
                target: { tabId: tabId },
                files: ['style.css']
            });

            // Inject the HTML injection script
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['html.js']
            });

            // Inject the main script
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['script.js']
            });

            console.log('✅ Interface injection completed for tab:', tabId);

        } catch (error) {
            console.error('❌ Error during interface injection:', error);
            throw error;
        }
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.type) {
                case 'STATUS_UPDATE':
                    await this.handleStatusUpdate(message, sender);
                    break;
                    
                case 'ANALYSIS_COMPLETE':
                    await this.handleAnalysisComplete(message, sender);
                    break;
                    
                case 'UNFOLLOW_COMPLETE':
                    await this.handleUnfollowComplete(message, sender);
                    break;
                    
                case 'ERROR_OCCURRED':
                    await this.handleError(message, sender);
                    break;
                    
                default:
                    console.log('🎯 Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('❌ Error handling message:', error);
        }
    }

    async handleStatusUpdate(message, sender) {
        console.log('🎯 Status update:', message.status);
        
        // Update extension badge if needed
        if (message.status.includes('Analyzing') || message.status.includes('Unfollowing')) {
            await chrome.action.setBadgeText({
                text: '...',
                tabId: sender.tab.id
            });
            await chrome.action.setBadgeBackgroundColor({
                color: '#9147ff',
                tabId: sender.tab.id
            });
        } else {
            await chrome.action.setBadgeText({
                text: '',
                tabId: sender.tab.id
            });
        }
    }

    async handleAnalysisComplete(message, sender) {
        console.log('🎯 Analysis completed:', message.totalChannels, 'channels found');
        
        // Store analysis data
        await chrome.storage.local.set({
            lastAnalysis: Date.now(),
            totalChannels: message.totalChannels,
            analysisHistory: await this.updateAnalysisHistory(message.totalChannels)
        });

        // Update badge
        await chrome.action.setBadgeText({
            text: message.totalChannels.toString(),
            tabId: sender.tab.id
        });
        await chrome.action.setBadgeBackgroundColor({
            color: '#2ed573',
            tabId: sender.tab.id
        });
    }

    async handleUnfollowComplete(message, sender) {
        console.log('🎯 Unfollow completed:', message.unfollowedCount, 'channels unfollowed');
        
        // Update storage
        const currentData = await chrome.storage.local.get('unfollowedCount');
        const newCount = (currentData.unfollowedCount || 0) + message.unfollowedCount;
        
        await chrome.storage.local.set({
            unfollowedCount: newCount,
            lastUnfollow: Date.now()
        });

        // Clear badge
        await chrome.action.setBadgeText({
            text: '',
            tabId: sender.tab.id
        });

        // Show notification
        await this.showNotification(
            'Unfollow Complete',
            `Successfully unfollowed ${message.unfollowedCount} channels!`
        );
    }

    async handleError(message, sender) {
        console.error('🎯 Error occurred:', message.error);
        
        // Clear badge
        await chrome.action.setBadgeText({
            text: '',
            tabId: sender.tab.id
        });

        // Show error notification
        await this.showNotification(
            'Error Occurred',
            message.error,
            'error'
        );
    }

    async updateAnalysisHistory(totalChannels) {
        try {
            const data = await chrome.storage.local.get('analysisHistory');
            const history = data.analysisHistory || [];
            
            history.push({
                date: Date.now(),
                totalChannels: totalChannels
            });
            
            // Keep only last 10 entries
            return history.slice(-10);
        } catch (error) {
            console.error('Error updating analysis history:', error);
            return [];
        }
    }

    async showNotification(title, message, type = 'info') {
        try {
            await chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon.png',
                title: title,
                message: message
            });
        } catch (error) {
            console.error('Error showing notification:', error);
        }
    }

    // Utility method to get current tab
    async getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    // Utility method to check if user is logged into Twitch
    async checkTwitchLogin() {
        try {
            const response = await fetch('https://www.twitch.tv/', {
                method: 'GET',
                credentials: 'include'
            });
            
            // This is a simplified check
            // In a real implementation, you'd want to check for specific Twitch login indicators
            return response.ok;
        } catch (error) {
            console.error('Error checking Twitch login:', error);
            return false;
        }
    }
}

// Initialize background manager
new BackgroundManager();

// Handle installation
chrome.runtime.onInstalled.addListener((details) => {
            console.log('🚀 Twitch Unfollow Pro installed:', details.reason);
    
    if (details.reason === 'install') {
        // First time installation
        chrome.storage.local.set({
            installDate: Date.now(),
            version: '2.0.0',
            totalUnfollowed: 0,
            analysisHistory: []
        });
        
        console.log('✅ Initial storage setup completed');
    } else if (details.reason === 'update') {
        // Extension updated
        chrome.storage.local.set({
            lastUpdate: Date.now(),
            version: '2.0.0'
        });
        
        console.log('✅ Update completed');
    }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
    console.log('🚀 Twitch Unfollow Pro started');
});
