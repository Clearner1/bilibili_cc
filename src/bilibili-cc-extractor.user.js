// ==UserScript==
// @name         Bilibili CC Viewer
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  在B站视频页面显示CC字幕
// @author       Zane
// @match        *://*.bilibili.com/video/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 获取视频信息的多种方式
    function getVideoInfo() {
        console.log('Getting video info...');
        
        // 从多个可能的位置获取视频信息
        const info = {
            aid: window.aid || window.__INITIAL_STATE__?.aid,
            bvid: window.bvid || window.__INITIAL_STATE__?.bvid,
            cid: window.cid
        };

        // 如果没有cid,尝试其他方式获取
        if (!info.cid) {
            const state = window.__INITIAL_STATE__;
            info.cid = state?.videoData?.cid || state?.epInfo?.cid;
        }

        // 如果还是没有,从player对象获取
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
    }

    // 获取字幕配置
    async function getSubtitleConfig(info) {
        console.log('Getting subtitle config...');
        
        // 尝试多个API端点
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
    }

    // 获取字幕内容
    async function getSubtitleContent(subtitleUrl) {
        console.log('Getting subtitle content from:', subtitleUrl);
        
        try {
            // 强制使用HTTPS
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

    // UI相关代码保持不变...
    function createUI() {
        const btn = document.createElement('button');
        btn.innerText = '显示CC字幕';
        btn.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 9999;
            padding: 8px 16px;
            background: #00a1d6;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        `;
        document.body.appendChild(btn);

        const container = document.createElement('div');
        container.id = 'cc-container';
        container.style.cssText = `
            position: fixed;
            right: 20px;
            top: 20px;
            width: 300px;
            max-height: 80vh;
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px;
            border-radius: 8px;
            z-index: 9999;
            display: none;
        `;
        document.body.appendChild(container);

        return { btn, container };
    }

    function formatTime(seconds) {
        const date = new Date(seconds * 1000);
        const hh = String(Math.floor(seconds/3600)).padStart(2,'0');
        const mm = String(date.getMinutes()).padStart(2,'0');
        const ss = String(date.getSeconds()).padStart(2,'0');
        const ms = String(date.getMilliseconds()).slice(0,3).padStart(3,'0');
        return `${hh}:${mm}:${ss},${ms}`;
    }

    function displaySubtitles(subtitles, container) {
        const subtitleHtml = subtitles.body.map(item => `
            <div class="cc-item" style="margin-bottom: 15px;">
                <div class="cc-time" style="font-size: 12px; color: #999; margin-bottom: 5px;">
                    ${formatTime(item.from)} --> ${formatTime(item.to)}
                </div>
                <div class="cc-text" style="font-size: 14px; line-height: 1.4;">
                    ${item.content}
                </div>
            </div>
        `).join('');

        container.innerHTML = subtitleHtml;
        container.style.display = 'block';
    }

    // 主函数
    async function main() {
        const { btn, container } = createUI();
        let isShowing = false;

        btn.addEventListener('click', async () => {
            if (isShowing) {
                container.style.display = 'none';
                btn.innerText = '显示CC字幕';
                isShowing = false;
                return;
            }

            try {
                // 1. 获取视频信息
                const videoInfo = getVideoInfo();
                if (!videoInfo.cid) {
                    throw new Error('无法获取视频信息');
                }

                // 2. 获取字幕配置
                const subtitleConfig = await getSubtitleConfig(videoInfo);
                if (!subtitleConfig) {
                    throw new Error('该视频没有CC字幕');
                }

                // 3. 获取字幕内容
                const subtitles = await getSubtitleContent(subtitleConfig.subtitles[0].subtitle_url);
                if (!subtitles) {
                    throw new Error('获取字幕内容失败');
                }

                // 4. 显示字幕
                displaySubtitles(subtitles, container);
                btn.innerText = '隐藏CC字幕';
                isShowing = true;
            } catch (error) {
                console.error('Error:', error);
                alert(error.message);
            }
        });
    }

    // 等待页面加载完成后执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
})(); 