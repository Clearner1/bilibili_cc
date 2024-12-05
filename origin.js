// ==UserScript==
// @name         Bilibili CC字幕实时显示插件
// @name:en      Bilibili CC Subtitle Extractor
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  在B站播放器中集成CC字幕列表
// @description:en  Integrate CC subtitle list in Bilibili video player
// @author       Zane
// @match        *://*.bilibili.com/video/*
// @grant        none
// @license      MIT
// ==/UserScript==
 
(function() {
    'use strict';
 
    // 字幕获取模块
    const SubtitleFetcher = {
        // 获取视频信息
        async getVideoInfo() {
            console.log('Getting video info...');
            
            const info = {
                aid: window.aid || window.__INITIAL_STATE__?.aid,
                bvid: window.bvid || window.__INITIAL_STATE__?.bvid,
                cid: window.cid
            };
 
            if (!info.cid) {
                const state = window.__INITIAL_STATE__;
                info.cid = state?.videoData?.cid || state?.epInfo?.cid;
            }
 
            if (!info.cid && window.player) {
                try {
                    const playerInfo = window.player.getVideoInfo();
                    info.cid = playerInfo.cid;
                    info.aid = playerInfo.aid;
                    info.bvid = playerInfo.bvid;
                } catch (e) {
                    console.log('Failed to get info from player:', e);
                }
            }
 
            console.log('Video info:', info);
            return info;
        },
 
        // 获取字幕配置
        async getSubtitleConfig(info) {
            console.log('Getting subtitle config...');
            
            const apis = [
                `//api.bilibili.com/x/player/v2?cid=${info.cid}&bvid=${info.bvid}`,
                `//api.bilibili.com/x/v2/dm/view?aid=${info.aid}&oid=${info.cid}&type=1`,
                `//api.bilibili.com/x/player/wbi/v2?cid=${info.cid}`
            ];
 
            for (const api of apis) {
                try {
                    console.log('Trying API:', api);
                    const res = await fetch(api);
                    const data = await res.json();
                    console.log('API response:', data);
 
                    if (data.code === 0 && data.data?.subtitle?.subtitles?.length > 0) {
                        return data.data.subtitle;
                    }
                } catch (e) {
                    console.log('API failed:', e);
                }
            }
 
            return null;
        },
 
        // 获取字幕内容
        async getSubtitleContent(subtitleUrl) {
            console.log('Getting subtitle content from:', subtitleUrl);
            
            try {
                const url = subtitleUrl.replace(/^http:/, 'https:');
                console.log('Using HTTPS URL:', url);
                
                const res = await fetch(url);
                const data = await res.json();
                console.log('Subtitle content:', data);
                return data;
            } catch (e) {
                console.error('Failed to get subtitle content:', e);
                return null;
            }
        }
    };
 
    // 时间格式化模块
    const TimeFormatter = {
        formatTime(seconds) {
            const mm = String(Math.floor(seconds/60)).padStart(2,'0');
            const ss = String(Math.floor(seconds%60)).padStart(2,'0');
            return `${mm}:${ss}`;
        },
        
        // 如果需要其他格式的时间显示，可以添加更多方法
        formatTimeWithMs(seconds) {
            const date = new Date(seconds * 1000);
            const mm = String(Math.floor(seconds/60)).padStart(2,'0');
            const ss = String(Math.floor(seconds%60)).padStart(2,'0');
            const ms = String(date.getMilliseconds()).slice(0,3).padStart(3,'0');
            return `${mm}:${ss},${ms}`;
        }
    };
 
    // UI渲染模块更新
    const SubtitleUI = {
        injectStyles() {
            const style = document.createElement('style');
            style.textContent = `
                .subtitle-container {
                    font-family: "PingFang SC", HarmonyOS_Regular, "Helvetica Neue", "Microsoft YaHei", sans-serif;
                    font-size: 14px;
                    -webkit-font-smoothing: antialiased;
                    color: rgb(24, 25, 28);
                    margin-top: 12px;
                }
    
                .subtitle-container * {
                    scrollbar-width: thin;
                    scrollbar-color: #99a2aa #fff;
                }
 
                .subtitle-container *::-webkit-scrollbar {
                    width: 4px;
                }
 
                .subtitle-container *::-webkit-scrollbar-track {
                    background: transparent;
                }
 
                .subtitle-container *::-webkit-scrollbar-thumb {
                    background-color: #99a2aa;
                    border-radius: 2px;
                }
    
                .subtitle-header {
                    display: flex;
                    align-items: center;
                    background-color: rgb(241, 242, 243);
                    height: 44px;
                    padding: 0 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    user-select: none;
                    position: relative;
                }
    
                .subtitle-content {
                    background: var(--bg1, #fff);
                    height: 0;
                    overflow: hidden;
                    transition: all 0.3s;
                }
    
                .subtitle-function {
                    display: flex;
                    align-items: center;
                    height: 36px;
                    padding: 0 12px;
                    border-bottom: 1px solid var(--border, #e3e5e7);
                    justify-content: space-between;
                }
    
                .subtitle-function-btn {
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    color: #999;
                }
 
                .subtitle-function-btn:first-child {
                    width: 60px;
                }
 
                .subtitle-function-btn:last-child {
                    margin-left: 12px;
                }
 
                .subtitle-wrap {
                    height: 393px;
                    overflow-y: auto;
                    overscroll-behavior: contain;
                }
    
                .subtitle-item {
                    display: flex;
                    align-items: center;
                    padding: 0 12px;
                    height: 24px;
                    transition: background-color 0.3s;
                    cursor: pointer;
                }
    
                .subtitle-item:hover {
                    background: var(--bg2, #f1f2f3);
                }
    
                .subtitle-item.active {
                    background: var(--bg2, #f1f2f3);
                    color: var(--brand_blue, #00a1d6);
                }
    
                .subtitle-time {
                    width: 60px;
                    color: #999;
                    flex-shrink: 0;
                }
    
                .subtitle-text {
                    flex: 1;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    margin: 0 12px;
                }
    
                .arrow-icon {
                    margin-right: 8px;
                    transition: transform 0.3s;
                }
    
                .arrow-icon.expanded {
                    transform: rotate(90deg);
                }
    
                .bui-collapse-wrap {
                    width: 350px;
                }
 
                .subtitle-function-left {
                    display: flex;
                    align-items: center;
                }
 
                .subtitle-function-right {
                    display: flex;
                    align-items: center;
                }
 
                .toggle-view-btn {
                    margin-left: auto;
                    padding: 4px 8px;
                    border: 1px solid #e3e5e7;
                    border-radius: 4px;
                    background: white;
                    color: #00a1d6;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.3s;
                }
 
                .toggle-view-btn:hover {
                    background: rgba(0, 161, 214, 0.1);
                }
 
                .merged-view {
                    padding: 12px;
                    line-height: 1.8;
                    white-space: pre-wrap;
                    word-break: break-word;
                }

                .subtitle-span {
                    display: inline;
                    transition: all 0.3s ease;
                    border-radius: 2px;
                    cursor: pointer;
                    padding: 2px 0;
                }

                .subtitle-span.active {
                    background-color: rgba(0, 161, 214, 0.1);
                    color: var(--brand_blue, #00a1d6);
                    padding: 2px 4px;
                    margin: 0 -4px;
                }

                .subtitle-span:hover {
                    background-color: rgba(0, 161, 214, 0.05);
                }

                .subtitle-separator {
                    display: inline;
                    white-space: pre-wrap;
                }
            `;
            document.head.appendChild(style);
        },
    
        isElementScrollable(element) {
            return element.scrollHeight > element.clientHeight;
        },
    
        createSubtitleUI() {
            const container = document.createElement('div');
            container.className = 'subtitle-container';
            
            // 头部
            const header = document.createElement('div');
            header.className = 'subtitle-header';
            header.innerHTML = `
                <div class="arrow-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
                        <path d="m9.188 7.999-3.359 3.359a.75.75 0 1 0 1.061 1.061l3.889-3.889a.75.75 0 0 0 0-1.061L6.89 3.58a.75.75 0 1 0-1.061 1.061l3.359 3.358z"/>
                    </svg>
                </div>
                <span>字幕列表</span>
                <button class="toggle-view-btn">切换显示模式</button>
            `;
    
            // 内容区
            const content = document.createElement('div');
            content.className = 'subtitle-content';
            
            const function_bar = document.createElement('div');
            function_bar.className = 'subtitle-function';
            function_bar.innerHTML = `
                <div class="subtitle-function-left">
                    <div class="subtitle-function-btn">
                        <span>时间</span>
                    </div>
                    <div class="subtitle-function-btn">
                        <span>字幕内容</span>
                    </div>
                </div>
            `;
            
            const wrap = document.createElement('div');
            wrap.className = 'subtitle-wrap';
 
            // 移除原有的wheel事件处理，改为监听scroll事件
            wrap.addEventListener('scroll', () => {
                SubtitleSync.ScrollControl.onManualScroll();
            });
            
            content.appendChild(function_bar);
            content.appendChild(wrap);
    
            container.appendChild(header);
            container.appendChild(content);
    
            return { container, header, content: wrap };
        }
    };
 
    // 字幕同步模块更新
    const SubtitleSync = {
        isVideoPlaying: true, // 视频播放状态
        lastManualScrollTime: 0, // 最后一次手动滚动时间
        
        // 添加新的滚动控制对象
        ScrollControl: {
            isManualScrolling: false,
            scrollTimeout: null,
            
            onManualScroll() {
                this.isManualScrolling = true;
                clearTimeout(this.scrollTimeout);
                this.scrollTimeout = setTimeout(() => {
                    this.isManualScrolling = false;
                }, 3000); // 3秒后恢复自动滚动
            },
            
            shouldAutoScroll() {
                return !this.isManualScrolling;
            }
        },
 
        displaySubtitles(subtitles, container, isMergedView = false) {
            if (isMergedView) {
                this.displayMergedSubtitles(subtitles, container);
                return;
            }
 
            const subtitleHtml = subtitles.body.map((item, index) => `
                <div class="subtitle-item" data-index="${index}">
                    <span class="subtitle-time">${TimeFormatter.formatTime(item.from)}</span>
                    <span class="subtitle-text">${item.content}</span>
                </div>
            `).join('');
 
            container.innerHTML = subtitleHtml;
 
            // 添加点击事件
            container.querySelectorAll('.subtitle-item').forEach(item => {
                item.addEventListener('click', () => {
                    const index = parseInt(item.dataset.index);
                    const subtitle = subtitles.body[index];
                    if (window.player && subtitle) {
                        window.player.seek(subtitle.from);
                    }
                });
            });
 
            // 添加滚动监听
            container.addEventListener('scroll', () => {
                this.lastManualScrollTime = Date.now();
            });
 
            // 监听视播放状态
            if (window.player) {
                const observer = new MutationObserver(() => {
                    const video = document.querySelector('video');
                    if (video) {
                        this.isVideoPlaying = !video.paused;
                    }
                });
 
                observer.observe(document.querySelector('.bpx-player-container'), {
                    subtree: true,
                    attributes: true
                });
            }
        },
 
        // 计算元素在容器中的相对位置
        getRelativePosition(element, container) {
            const containerRect = container.getBoundingClientRect();
            const elementRect = element.getBoundingClientRect();
            
            return {
                top: elementRect.top - containerRect.top,
                bottom: elementRect.bottom - containerRect.top
            };
        },
 
        // 检查元素是否在容器的可视区域内
        isElementInViewport(element, container) {
            const pos = this.getRelativePosition(element, container);
            const containerHeight = container.clientHeight;
            
            // 虑一定的缓冲区域
            const buffer = 50;
            return pos.top >= -buffer && pos.bottom <= containerHeight + buffer;
        },
 
        // 平滑滚动到指定元素
        smoothScrollToElement(element, container) {
            const pos = this.getRelativePosition(element, container);
            const containerHeight = container.clientHeight;
            const targetScroll = container.scrollTop + pos.top - containerHeight / 2;
            
            container.scrollTo({
                top: targetScroll,
                behavior: 'smooth'
            });
        },
 
        // 更新highlightCurrentSubtitle方法
        highlightCurrentSubtitle(subtitles, container, isMergedView = false) {
            const currentTime = window.player?.getCurrentTime() || 0;
            
            if (isMergedView) {
                // 获取所有字幕span
                const spans = container.querySelectorAll('.subtitle-span');
                let activeSpanFound = false;

                spans.forEach(span => {
                    const from = parseFloat(span.dataset.from);
                    const to = parseFloat(span.dataset.to);
                    
                    if (currentTime >= from && currentTime <= to) {
                        span.classList.add('active');
                        activeSpanFound = true;
                        
                        // 只在应该自动滚动时执行滚动
                        if (this.isVideoPlaying && this.ScrollControl.shouldAutoScroll()) {
                            if (!this.isElementInViewport(span, container)) {
                                this.smoothScrollToElement(span, container);
                            }
                        }
                    } else {
                        span.classList.remove('active');
                    }
                });

                // 如果没有找到活动的span，可能需要特殊处理
                if (!activeSpanFound) {
                    // 可以选择最近的字幕
                    this.highlightNearestSubtitle(currentTime, spans);
                }
            } else {
                // 单条显示模式的高亮逻辑
                container.querySelectorAll('.subtitle-item').forEach(item => {
                    item.classList.remove('active');
                });

                const currentSubtitle = subtitles.body.find(item => 
                    currentTime >= item.from && currentTime <= to
                );

                if (currentSubtitle) {
                    const index = subtitles.body.indexOf(currentSubtitle);
                    const currentElement = container.querySelector(`.subtitle-item[data-index="${index}"]`);
                    
                    if (currentElement) {
                        currentElement.classList.add('active');
                        // 只在应该自动滚动时执行滚动
                        if (this.isVideoPlaying && this.ScrollControl.shouldAutoScroll()) {
                            if (!this.isElementInViewport(currentElement, container)) {
                                this.smoothScrollToElement(currentElement, container);
                            }
                        }
                    }
                }
            }
        },
 
        // 添加新方法用于显示合并视图
        displayMergedSubtitles(subtitles, container) {
            // 创建包装器div
            const mergedContent = document.createElement('div');
            mergedContent.className = 'merged-view';
            
            // 处理每个字幕
            subtitles.body.forEach((item, index) => {
                // 创建字幕span
                const subtitleSpan = document.createElement('span');
                subtitleSpan.className = 'subtitle-span';
                subtitleSpan.dataset.index = index;
                subtitleSpan.dataset.from = item.from;
                subtitleSpan.dataset.to = item.to;
                subtitleSpan.textContent = item.content;
                
                // 添加到容器
                mergedContent.appendChild(subtitleSpan);
                
                // 添加分隔符（空格）
                if (index < subtitles.body.length - 1) {
                    const separator = document.createElement('span');
                    separator.className = 'subtitle-separator';
                    separator.textContent = ' ';
                    mergedContent.appendChild(separator);
                }
            });

            // 清空并设置新内容
            container.innerHTML = '';
            container.appendChild(mergedContent);
        },
 
        // 添加辅助方法来处理最近字幕的高亮
        highlightNearestSubtitle(currentTime, spans) {
            let nearestSpan = null;
            let minDiff = Infinity;

            spans.forEach(span => {
                const from = parseFloat(span.dataset.from);
                const to = parseFloat(span.dataset.to);
                const diff = Math.min(
                    Math.abs(currentTime - from),
                    Math.abs(currentTime - to)
                );

                if (diff < minDiff) {
                    minDiff = diff;
                    nearestSpan = span;
                }
            });

            if (nearestSpan && minDiff < 1) { // 1秒内的最近字幕
                nearestSpan.classList.add('active');
            }
        }
    };
 
    // 主函数更新
    async function main() {
        // 等待弹幕列表容器加载
        const danmakuContainer = await new Promise(resolve => {
            const check = () => {
                const container = document.querySelector('.bui-collapse-wrap');
                if (container) {
                    resolve(container);
                } else {
                    setTimeout(check, 1000);
                }
            };
            check();
        });
 
        // 注入样式
        SubtitleUI.injectStyles();
 
        // 创建UI
        const { container, header, content } = SubtitleUI.createSubtitleUI();
        danmakuContainer.appendChild(container);
 
        // 切换展开/收起
        let isExpanded = false;
        header.addEventListener('click', () => {
            isExpanded = !isExpanded;
            container.querySelector('.subtitle-content').style.height = 
                isExpanded ? '429px' : '0';  // 36px(功能栏) + 393px(内容区)
            header.querySelector('.arrow-icon').classList.toggle('expanded', isExpanded);
        });
        // 声明subtitles变量
        let subtitles = null;
 
        // 加载字幕
        try {
            const videoInfo = await SubtitleFetcher.getVideoInfo();
            if (!videoInfo.cid) {
                throw new Error('无法获取视频信息');
            }
 
            const subtitleConfig = await SubtitleFetcher.getSubtitleConfig(videoInfo);
            if (!subtitleConfig) {
                throw new Error('该视频没有CC字幕');
            }
 
            subtitles = await SubtitleFetcher.getSubtitleContent(subtitleConfig.subtitles[0].subtitle_url);
            if (!subtitles) {
                throw new Error('获取字幕内容失败');
            }
 
            let isMergedView = false;
            const toggleViewBtn = container.querySelector('.toggle-view-btn');
 
            // 添加切换按钮事件监听
            toggleViewBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 防止触发折叠面板
                isMergedView = !isMergedView;
                toggleViewBtn.textContent = isMergedView ? '切换单条显示' : '切换合并显示';
                SubtitleSync.displaySubtitles(subtitles, content, isMergedView);
            });
 
            // 显示字幕
            SubtitleSync.displaySubtitles(subtitles, content, isMergedView);
 
            // 更新字幕同步逻辑
            setInterval(() => {
                if (isExpanded) {  // 移除!isMergedView条件
                    SubtitleSync.highlightCurrentSubtitle(subtitles, content, isMergedView);
                }
            }, 100);
 
            // 在合并视图中添加点击事件处理
            content.addEventListener('click', (e) => {
                const span = e.target.closest('.subtitle-span');
                if (span && window.player) {
                    const from = parseFloat(span.dataset.from);
                    window.player.seek(from);
                }
            });
 
        } catch (error) {
            console.error('Error:', error);
            content.innerHTML = `<div class="subtitle-item">${error.message}</div>`;
        }
    }
 
    // 等待页面加载完成后执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
})(); 