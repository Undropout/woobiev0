// shared/emoji-loader.js - Fixed with proper fallbacks
class WoobieEmojiLoader {
    constructor() {
      this.loadedEmojis = new Set();
      this.emojiCache = new Map();
      this.baseUrl = '/emoji/'; // Your emoji SVG directory
      this.fallbackMode = false; // Switch to fallback if SVGs fail
      
      // Emoji to SVG filename mapping (OpenMoji naming convention)
      this.emojiMap = {
        // UI Elements
        '🎲': '1F3B2',
        '🎰': '1F3B0', 
        '✅': '2705',
        '🚪': '1F6AA',
        '✨': '2728',
        '💡': '1F4A1',
        '🌌': '1F30C',
        '📜': '1F4DC',
        '❌': '274C',
        
        // Common animals that will definitely appear
        '🍯': '1F36F',
        '🦡': '1F9A1',
        '🐡': '1F421',
        '🦜': '1F99C',
        '🐸': '1F438',
        '🦊': '1F98A',
        '🐺': '1F43A',
        '🦅': '1F985',
        '🐉': '1F409',
        '🦄': '1F984',
        '🦖': '1F996',
        '🦀': '1F980'
      };
    }
  
    // Create styled fallback emoji (amber colored, not just glowing)
    createStyledFallback(emoji) {
      return `<span style="color: #ffb000; text-shadow: 0 0 10px #ffb000, 0 0 15px #ff9900; filter: sepia(100%) saturate(150%) hue-rotate(25deg);">${emoji}</span>`;
    }
  
    // Validate SVG response
    isValidSvg(text) {
      return text.includes('<svg') && text.includes('</svg>') && !text.includes('<html>');
    }
  
    // Load specific emoji SVG with robust fallback
    async loadEmoji(emoji) {
      if (this.loadedEmojis.has(emoji)) {
        return this.emojiCache.get(emoji);
      }
  
      // If we're in fallback mode, just return styled emoji immediately
      if (this.fallbackMode) {
        const styledEmoji = this.createStyledFallback(emoji);
        this.emojiCache.set(emoji, styledEmoji);
        this.loadedEmojis.add(emoji);
        return styledEmoji;
      }
  
      const filename = this.emojiMap[emoji];
      if (!filename) {
        console.warn(`No SVG mapping for emoji: ${emoji} - using fallback`);
        const fallback = this.createStyledFallback(emoji);
        this.emojiCache.set(emoji, fallback);
        this.loadedEmojis.add(emoji);
        return fallback;
      }
  
      try {
        const response = await fetch(`${this.baseUrl}${filename}.svg`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${filename}.svg`);
        }
        
        const svgText = await response.text();
        
        // Validate that we got an actual SVG, not an HTML error page
        if (!this.isValidSvg(svgText)) {
          throw new Error(`Invalid SVG content for ${filename}.svg - got: ${svgText.substring(0, 100)}...`);
        }
        
        // Create styled SVG wrapper
        const styledSvg = this.createStyledEmojiSvg(svgText, emoji);
        
        this.emojiCache.set(emoji, styledSvg);
        this.loadedEmojis.add(emoji);
        
        console.log(`✅ Loaded BLACK emoji SVG: ${emoji} (${filename}.svg) - tinted to amber`);
        return styledSvg;
        
      } catch (error) {
        console.warn(`⚠️ Failed to load SVG for ${emoji} (${filename}.svg):`, error.message);
        console.warn(`   Falling back to styled text emoji`);
        
        // Check if this is a systemic failure (multiple SVGs failing)
        const failureCount = this.getFailureCount();
        if (failureCount > 3) {
          console.warn('🚨 Multiple emoji SVG failures detected - switching to fallback mode');
          this.fallbackMode = true;
        }
        
        // Return styled text emoji as fallback
        const fallback = this.createStyledFallback(emoji);
        this.emojiCache.set(emoji, fallback);
        this.loadedEmojis.add(emoji);
        return fallback;
      }
    }
  
    // Create styled SVG with woobiecore aesthetic - PROPER AMBER TINTING
    createStyledEmojiSvg(svgText, originalEmoji) {
      // Clean the SVG text and add proper styling
      const cleanSvg = svgText.replace(/width="[^"]*"/g, 'width="1em"')
                              .replace(/height="[^"]*"/g, 'height="1em"')
                              .replace(/stroke-width="[^"]*"/g, 'stroke-width="2"'); // Fix stroke width
      
      // CRITICAL: Properly tint the black SVG to amber color, don't just add glow
      return `<span class="woobie-emoji-svg" style="display: inline-block; vertical-align: middle;" title="${originalEmoji}">
        <span style="display: inline-block; filter: sepia(100%) saturate(200%) hue-rotate(25deg) brightness(1.2) drop-shadow(0 0 8px #ffb000) drop-shadow(0 0 12px #ff9900);">${cleanSvg}</span>
      </span>`;
    }
  
    // Get failure count for fallback detection
    getFailureCount() {
      return Array.from(this.emojiCache.values())
                  .filter(value => value.includes('text-shadow') && !value.includes('<svg')).length;
    }
  
    // Process text and replace emojis (simplified to avoid infinite loops)
    async processText(text, maxEmojis = 10) {
      if (!text || typeof text !== 'string') return text;
      
      const emojisInText = [];
      let processedCount = 0;
      
      // Find emojis in text, but limit processing to prevent issues
      for (const emoji of Object.keys(this.emojiMap)) {
        if (text.includes(emoji) && processedCount < maxEmojis) {
          emojisInText.push(emoji);
          processedCount++;
        }
      }
  
      if (emojisInText.length === 0) {
        return text; // No emojis to process
      }
  
      // Load required emojis
      const loadPromises = emojisInText.map(emoji => this.loadEmoji(emoji));
      const loadedResults = await Promise.all(loadPromises);
  
      // Replace emojis with loaded results
      let processedText = text;
      emojisInText.forEach((emoji, index) => {
        const replacement = loadedResults[index];
        // Use a more careful replacement to avoid issues
        processedText = processedText.split(emoji).join(replacement);
      });
  
      return processedText;
    }
  
    // Simplified element processing to avoid DOM disasters
    async processElements(elements) {
      if (!elements || !Array.isArray(elements)) return;
  
      for (const element of elements) {
        if (!element || element.hasAttribute('data-emoji-processed')) {
          continue; // Skip already processed elements
        }
  
        try {
          const originalText = element.textContent;
          if (!originalText) continue;
  
          const processedHtml = await this.processText(originalText, 3); // Limit to 3 emojis per element
          
          if (processedHtml !== originalText) {
            element.innerHTML = processedHtml;
            element.setAttribute('data-emoji-processed', 'true');
            console.log(`Processed element: ${element.tagName}${element.id ? '#' + element.id : ''}`);
          }
        } catch (error) {
          console.error('Error processing element:', element, error);
          // Continue with other elements even if one fails
        }
      }
    }
  
    // Test SVG endpoint to see if it's working
    async testSvgEndpoint() {
      try {
        const testResponse = await fetch(`${this.baseUrl}1F3B2.svg`);
        const testText = await testResponse.text();
        
        if (this.isValidSvg(testText)) {
          console.log('✅ SVG endpoint is working');
          return true;
        } else {
          console.warn('⚠️ SVG endpoint returns HTML instead of SVG');
          return false;
        }
      } catch (error) {
        console.warn('⚠️ SVG endpoint test failed:', error.message);
        return false;
      }
    }
  
    // Preload commonly used emojis with endpoint test
    async preloadCommonEmojis() {
      // Test if SVG endpoint works first
      const svgWorking = await this.testSvgEndpoint();
      if (!svgWorking) {
        console.warn('🚨 SVG endpoint not working - using fallback mode');
        this.fallbackMode = true;
      }
  
      const commonEmojis = ['🎲', '✨', '💡', '🌌', '🎰', '✅', '🚪', '📜']; 
      const preloadPromises = commonEmojis.map(emoji => this.loadEmoji(emoji));
      await Promise.all(preloadPromises);
      console.log('🚀 Preloaded common emojis');
    }
  
    // Get cache stats for debugging
    getCacheStats() {
      const svgCount = Array.from(this.emojiCache.values())
                            .filter(value => value.includes('<svg')).length;
      const fallbackCount = this.loadedEmojis.size - svgCount;
      
      return {
        loadedCount: this.loadedEmojis.size,
        svgCount: svgCount,
        fallbackCount: fallbackCount,
        fallbackMode: this.fallbackMode,
        loadedEmojis: Array.from(this.loadedEmojis),
        estimatedBytes: svgCount * 2048 // Rough estimate per SVG
      };
    }
  
    // Force fallback mode (for testing or when SVGs aren't available)
    forceFallbackMode() {
      this.fallbackMode = true;
      console.log('🔄 Forced fallback mode - using styled text emojis');
    }
  }
  
  // Global instance
  window.woobieEmojiLoader = new WoobieEmojiLoader();
  
  export default WoobieEmojiLoader;