// ===== HTML INJECTION FOR TWITCH UNFOLLOW PRO =====
// This file handles the injection of the modern interface into Twitch pages

class InterfaceInjector {
    constructor() {
        this.isInjected = false;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.init();
    }

    async init() {
        try {
            console.log('🎯 Interface Injector: Starting...');
            
            // Wait for page to be ready
            await this.waitForPageReady();
            
            // Check if we're on the correct page
            if (!this.isOnCorrectPage()) {
                console.log('🎯 Interface Injector: Not on following page, skipping injection');
                return;
            }
            
            // Wait for Twitch elements to load
            await this.waitForTwitchElements();
            
            // Inject the interface
            await this.injectInterface();
            
            console.log('✅ Interface Injector: Successfully completed');
            
        } catch (error) {
            console.error('❌ Interface Injector: Error during initialization:', error);
            this.handleInjectionError(error);
        }
    }

    async waitForPageReady() {
        return new Promise((resolve) => {
            if (document.readyState === 'complete') {
                resolve();
                return;
            }
            
            const onReady = () => {
                if (document.readyState === 'complete') {
                    document.removeEventListener('readystatechange', onReady);
                    resolve();
                }
            };
            
            document.addEventListener('readystatechange', onReady);
        });
    }

    isOnCorrectPage() {
        return window.location.href.includes('twitch.tv/directory/following/channels');
    }

    async waitForTwitchElements() {
        const requiredSelectors = [
            '#following-page-main-content',
            '.simplebar-scroll-content',
            '[data-a-target="user-card-modal"]'
        ];

        try {
            // Wait for the main element first
            await this.waitForElement('#following-page-main-content', 15000);
            console.log('🎯 Found main following page element');

            // Wait a bit more to ensure other elements load
            await this.wait(2000);

            // Check if channel elements are loaded
            const userCards = document.querySelectorAll('[data-a-target="user-card-modal"]');
            if (userCards.length === 0) {
                console.log('🎯 Waiting for channels to load...');
                await this.waitForElement('[data-a-target="user-card-modal"]', 10000);
            }

            console.log('🎯 Twitch elements loaded successfully');
            return true;
            
        } catch (error) {
            console.warn('🎯 Some elements may not have fully loaded:', error.message);
            // Continue even if some elements do not load
            return true;
        }
    }

    async waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const checkElement = () => {
                const element = document.querySelector(selector);

                if (element) {
                    resolve(element);
                    return;
                }

                if (Date.now() - startTime >= timeout) {
                    reject(new Error(`Element ${selector} not found after ${timeout}ms`));
                    return;
                }

                setTimeout(checkElement, 100);
            };

            checkElement();
        });
    }

    async injectInterface() {
        // Check if interface is already injected
        if (document.getElementById('followManagerContainer')) {
            console.log('🎯 Interface already injected, skipping');
            return;
        }

        // Check if we're on the correct page
        const targetElement = document.getElementById('following-page-main-content');
        if (!targetElement) {
            throw new Error('Target element #following-page-main-content not found');
        }

        console.log('🎯 Injecting modern interface...');

        // The interface will be created by the main script
        // We just need to ensure the main script is loaded
        await this.ensureMainScriptLoaded();

        // Wait for the interface to be created
        await this.waitForInterfaceCreation();

        console.log('🎯 Interface injection completed');
    }

    async ensureMainScriptLoaded() {
        // Check if the main script is already loaded
        if (window.followManager) {
            return;
        }

        // The main script should be loaded via content script
        // If not, we'll wait a bit more
        await this.wait(1000);
    }

    async waitForInterfaceCreation() {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const timeout = 10000;

            const checkInterface = () => {
                const interface = document.getElementById('followManagerContainer');
                
                if (interface) {
                    resolve(interface);
                    return;
                }

                if (Date.now() - startTime >= timeout) {
                    reject(new Error('Interface creation timeout'));
                    return;
                }

                setTimeout(checkInterface, 100);
            };

            checkInterface();
        });
    }

    handleInjectionError(error) {
        this.retryCount++;
        
        if (this.retryCount < this.maxRetries) {
            console.log(`🎯 Retrying injection (${this.retryCount}/${this.maxRetries})...`);
            setTimeout(() => this.init(), 2000 * this.retryCount);
        } else {
            console.error('🎯 Max retries reached, giving up');
            this.showErrorNotification(error);
        }
    }

    showErrorNotification(error) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4757;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-family: 'Segoe UI', sans-serif;
            box-shadow: 0 4px 12px rgba(255, 71, 87, 0.3);
            max-width: 300px;
            cursor: pointer;
        `;
        errorDiv.innerHTML = `
            <strong>Twitch Follow Manager Error:</strong><br>
            ${error.message}
            <br><br>
            <small>Click to dismiss</small>
        `;

        errorDiv.addEventListener('click', () => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        });

        document.body.appendChild(errorDiv);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 10000);
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Observer to detect page changes (for SPA navigation)
class PageChangeObserver {
    constructor() {
        this.observer = null;
        this.currentUrl = window.location.href;
        this.init();
    }

    init() {
        // Watch for URL changes
        this.observer = new MutationObserver(() => {
            if (window.location.href !== this.currentUrl) {
                this.currentUrl = window.location.href;
                this.handlePageChange();
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Also watch for popstate events (browser back/forward)
        window.addEventListener('popstate', () => {
            this.handlePageChange();
        });
    }

    handlePageChange() {
        console.log('🎯 Page changed, checking if injection is needed...');
        
        // Small delay to ensure the page has loaded
        setTimeout(() => {
            if (this.isOnCorrectPage() && !document.getElementById('followManagerContainer')) {
                console.log('🎯 New page detected, initializing interface...');
                new InterfaceInjector();
            }
        }, 1000);
    }

    isOnCorrectPage() {
        return window.location.href.includes('twitch.tv/directory/following/channels');
    }
}

// Initialize everything
(async () => {
    try {
        console.log('🚀 Twitch Unfollow Pro: Starting interface injection...');
        
        // Initialize the interface injector
        new InterfaceInjector();
        
        // Initialize the page change observer
        new PageChangeObserver();
        
        console.log('✅ Twitch Unfollow Pro: Interface injection system ready');
        
    } catch (error) {
        console.error('❌ Twitch Unfollow Pro: Critical error during initialization:', error);
    }
})();
