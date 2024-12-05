// 创建字幕显示容器
function createCCContainer() {
  const container = document.createElement('div');
  container.id = 'cc-container';
  document.body.appendChild(container);
  return container;
}

// 获取视频信息
async function getVideoInfo() {
  const url = window.location.href;
  const bvid = url.match(/BV\w+/)?.[0];
  if (!bvid) return null;

  // 获取cid
  const cidRes = await fetch(`https://api.bilibili.com/x/player/pagelist?bvid=${bvid}`);
  const cidData = await cidRes.json();
  const cid = cidData.data[0].cid;

  return { bvid, cid };
}

// 获取CC字幕
async function getCCSubtitle(bvid, cid) {
  // 获取字幕配置
  const subtitleRes = await fetch(`https://api.bilibili.com/x/player/v2?cid=${cid}&bvid=${bvid}`);
  const subtitleData = await subtitleRes.json();
  
  if (!subtitleData.data?.subtitle?.subtitles?.length) {
    return null;
  }

  // 获取第一个字幕的URL
  const subtitleUrl = subtitleData.data.subtitle.subtitles[0].subtitle_url;
  if (!subtitleUrl) return null;

  // 获取字幕内容
  const ccRes = await fetch(subtitleUrl.startsWith('http') ? subtitleUrl : `https:${subtitleUrl}`);
  const ccData = await ccRes.json();
  
  return ccData;
}

// 显示字幕
function displaySubtitles(subtitles) {
  const container = createCCContainer();
  
  const subtitleHtml = subtitles.body.map(item => `
    <div class="cc-item">
      <div class="cc-time">${formatTime(item.from)} --> ${formatTime(item.to)}</div>
      <div class="cc-text">${item.content}</div>
    </div>
  `).join('');

  container.innerHTML = subtitleHtml;
}

// 格式化时间
function formatTime(seconds) {
  const date = new Date(seconds * 1000);
  const hh = String(Math.floor(seconds/3600)).padStart(2,'0');
  const mm = String(date.getMinutes()).padStart(2,'0');
  const ss = String(date.getSeconds()).padStart(2,'0');
  const ms = String(date.getMilliseconds()).slice(0,3).padStart(3,'0');
  return `${hh}:${mm}:${ss},${ms}`;
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener(async (request) => {
  if (request.action === "showCC") {
    try {
      const videoInfo = await getVideoInfo();
      if (!videoInfo) {
        alert('无法获取视频信息');
        return;
      }

      const subtitles = await getCCSubtitle(videoInfo.bvid, videoInfo.cid);
      if (!subtitles) {
        alert('该视频没有CC字幕');
        return;
      }

      displaySubtitles(subtitles);
    } catch (error) {
      console.error('获取字幕失败:', error);
      alert('获取字幕失败');
    }
  }
}); 