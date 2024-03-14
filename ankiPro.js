const fs = require("fs");
const path = require("path");

const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));
const random = (min, max) => min + Math.floor((max - min + 1) * Math.random());

const addNote = (payload = {}) => {
  let { token = "", frontSide = "", backSide = "", deckId = "" } = payload;

  token = token.trim();
  frontSide = frontSide.trim();
  backSide = backSide.trim();
  deckId = deckId.trim();
  if (!token) throw new Error("token为空");
  if (!frontSide) throw new Error("front_side为空");
  if (!backSide) throw new Error("back_side为空");
  if (!deckId) throw new Error("deck_id为空");

  const time = Math.floor(Date.now() / 1000);
  return fetch("https://api.ankipro.net/api/notes", {
    headers: {
      accept: "*/*",
      "accept-language": "zh,en;q=0.9,zh-CN;q=0.8,ja;q=0.7",
      "app-features":
        "nested_decks,speedLearning,templateIds,multipleCardsOutput,imageDimensions,v2CardsList,mediaInitializing,avatarColorV2,errorMessageV2,clozeCardV2,hierarchySchemaV2",
      "app-language": "en",
      "app-platform": "web",
      "app-version": "1.26.0",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "current-time": time.toString(),
      "sec-ch-ua":
        '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
    },
    referrer: "https://ankipro.net/",
    referrerPolicy: "strict-origin-when-cross-origin",
    body:
      '{"note":{"template_id":"front_to_back","fields":{"front_side":"<p>' +
      frontSide +
      '</p>","back_side":"<p>' +
      backSide +
      '</p>"},"deck_id":' +
      deckId +
      ',"field_attachments_map":{},"reverse":false}}',
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
};

const formatOriginDate = (content) => {
  content = content.split("\n").filter(Boolean);
  const list = [];

  // 章节
  const reg1 = /^第.+章\s.+/;
  // 发表想法
  const reg2 = /^◆\s\d{4}\/\d{1,2}\/\d{1,2}发表想法/;
  // 原文
  const reg3 = /^原文：/;
  // 普通下划线
  const reg4 = /^◆\s/;

  // 评论
  let isComment = false;
  // 原文
  let isOrigin = false;

  let frontSide = [];
  let backSide = [];
  for (let item of content) {
    // 跳过章节
    if (reg1.test(item)) continue;
    item = item.replace(/\[插图\]/g, "");
    item = item.replace(/"/g, '\\"');

    // 以 ◆ 开头的都认为是新item
    if (reg4.test(item)) {
      isComment = false;
      isOrigin = false;
      // 处理评论
      buildListItem(list, frontSide, backSide);
    }

    // 匹配发表想法，开启评论flag
    if (reg2.test(item)) {
      isComment = true;
      continue;
    }

    // 原文中间换了行，继续添加
    if (isOrigin) {
      frontSide.push(item);
    }

    // 匹配原文，关闭评论开关，打开原文开关
    if (reg3.test(item)) {
      isComment = false;
      isOrigin = true;
      item = item.replace(reg3, "");
      frontSide.push(item);
      contentSet.add(item);
    }

    // 添加想法
    if (isComment && !isOrigin) {
      backSide.push(item);
    }

    // 普通的下划线，以 ◆ 开头
    if (!isComment && !isOrigin) {
      // 处理评论
      buildListItem(list, frontSide, backSide);
      item = item.replace(reg4, "");
      if (contentSet.has(item)) {
        continue;
      }
      frontSide.push(item);
      backSide.push(defaultBackSide);
      // 处理普通下划线
      buildListItem(list, frontSide, backSide);
    }
  }

  // fs.writeFileSync(
  //   path.resolve(__dirname, "anki_read.json"),
  //   JSON.stringify(list),
  //   "utf-8"
  // );
  return list;
};

const formatReaminData = (content) => {
  return JSON.parse(content)
}

const formatCustomData = (content) => {
  if (!Array.isArray(content)) throw new TypeError(`文件格式错误，应为 module.exports = ['xxx', { f: 'yyy', b: 'zzz' }]`)

  return content.map(c => {
    let { f, b } = typeof c === 'string' ? { f: c, b: defaultBackSide } : c
    f = f.replace(/"/g, '\\"');
    b = b.replace(/"/g, '\\"');
    return {
      frontSide: f,
      backSide: b
    }
  })
}


const buildListItem = (list, frontSide, backSide) => {
  if (frontSide.length === 0 || backSide.length === 0) return;
  if (frontSide)
    list.push({
      frontSide: frontSide.join("</p><p>"),
      backSide: backSide.join("</p><p>"),
    });
  frontSide.length = 0;
  backSide.length = 0;
};

const readData = (type) => {
  const fileMap = {
    origin: {
      path: originPath,
      format: formatOriginDate,
      read: p => fs.readFileSync(p, "utf-8")
    },
    remain: {
      path: remainPath,
      format: formatReaminData,
      read: p => fs.readFileSync(p, "utf-8")
    },
    custom: {
      path: customPath,
      format: formatCustomData,
      read: p => require(p)
    },
  }
  const { path: filePath, format, read } = fileMap[type]
  if (!fs.existsSync(filePath)) {
    console.log(`${type} 对象的文件不存在，文件地址: ${filePath}`);
    return;
  }
  let content = read(filePath)
  content = format(content)
  return content;
};

const prompt = async (deckId) => {
  const type = process.argv.slice(2)[0];
  if (!type) {
    console.log(`请选择从哪里读取数据<type>：

    * origin: 从 ${ankiOrigin} 读取数据
    
    * remain: 从 ${ankiReamin} 读取数据（ 向anki添加数据时发生过错误，已将剩余数据写入了该文件，是否读取此文件？）

    * custom: 从 ${ankiCustom} 读取数据，是自定义数据，文件内容为 module.exports = ['xxx', { f: 'yyy', b: 'zzz' }]

    使用: "node ankiPro.js <type>"
    `);
    return;
  }
  const types = ["origin", "remain", "custom"];
  if (!types.includes(type)) {
    console.log(`只能从 ${types.join("，")} 中选择`);
    return;
  }
  const content = readData(type);
  console.log('content', content)
  await batchAddNote(content, deckId, 0);
};

const batchAddNote = async (list = [], deckId = "", index = 0) => {
  if (!deckId) throw new Error("deckId为空");
  if (typeof deckId !== 'string') throw new TypeError(`deckId应为字符串，得到的是${typeof deckId}`)

  if (list.length === 0) {
    console.log(`\n完成，共插入 ${index} 条`);
    return;
  }

  const payload = {
    ...list[0],
    token,
    deckId,
  };

  try {
    const res = await addNote(payload);
    await res.json();
    console.log(`已插入 ${index + 1} 条...`);
  } catch (e) {
    console.error(e.message);
    console.error(`  出错，已成功插入 ${index} 条，剩余写入 ${remainPath}`);
    fs.writeFileSync(remainPath, JSON.stringify(list), "utf-8");
    return;
  }
  const sleepTime = random(sleepMin, sleepMax);
  await sleep(sleepTime);
  index++;
  await batchAddNote(list.slice(1), deckId, index);
};

const token =
  "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MjUwNzI4MywiYXZhdGFyQ29sb3IiOnsibGlnaHQiOiIjNEU1RUU1IiwiZGFyayI6IiM5NUEwRkYifSwiYXZhdGFyVXJsIjpudWxsLCJuYW1lIjoiYmVrYSIsInVzZXJuYW1lIjoiYmVrYSIsImFuYWx5dGljc0lkIjoiNGZjMTBkYTAxOTBkOWEyMGUxODIwZTkyYzIwYzg4M2FjOWVhYjAxMjk3NGRiMDYwIiwiZW1haWwiOiI0MTM2NDY1NzlAcXEuY29tIiwiZXhwZXJpbWVudHMiOnsic3RyZWFrc192MSI6ImNvbnRyb2wiLCJsb25nX3BheXdhbGwiOiJjb250cm9sIiwicmF0ZV91c19hZnRlcl9zdHJlYWsiOiJkaXNhYmxlZCIsImFuZHJvaWRfdHJpYWxfd2FybmluZyI6InRlc3QiLCJvbmJvYXJkaW5nX2ltcHJvdmVtZW50cyI6ImRpc2FibGVkIiwiaGVscF9jZW50ZXJfcGxhY2VtZW50X2xpc3QiOiJjb250cm9sIiwiZXhwZXJpbWVudF8yNF9saWJyYXJ5X3JhdGluZ3MiOiJiX3VwZGF0ZWRfdmVyc2lvbiIsImFjdGl2aXR5X3NoYXJlX2J1dHRvbl9wbGFjZW1lbnQiOiJkaXNhYmxlZCIsImV4cGVyaW1lbnRfMjhfcW9udmVyc2lvbl9zdWJzY3JpcHRpb24iOiJxb252ZXJzaW9uIn0sImlzR3Vlc3QiOmZhbHNlLCJwcmVtaXVtIjpmYWxzZSwicHJvdmlkZXIiOiJlbWFpbCIsIm9uYm9hcmRpbmdEYXRhIjp7Im90aGVyR29hbEtleSI6ImhvYmJ5aXN0In0sInN0YXRzQ291bnRlcnMiOnsiY2FyZHNDcmVhdGVkIjoyMzYsImNhcmRzU3R1ZGllZCI6MzR9LCJzdHJlYWsiOnsiY3VycmVudER1cmF0aW9uIjowLCJhdmFpbGFibGVGcmVlemVDb3VudCI6MCwidG90YWxBY3RpdmVEYXlzIjozLCJsb25nZXN0RHVyYXRpb24iOjEsIm5leHRGcmVlemVNaW5pbXVtU3RyZWFrIjo3LCJ0b2RheUNvbXBsZXRlZCI6ZmFsc2UsInRvZGF5U2hvd24iOmZhbHNlfSwic3Vic2NyaXB0aW9uUHJvdmlkZXIiOm51bGx9.3bldEykBlYgyBXMbhOy4ks2J09df2HfpJ5nemPh-Ntk";

// 卡片集合
const deckMap = {
  句子: "48068251",
  曾国藩传: "50775042",
  知否知否: "51118594",
  向上生长: "51119218",
};

const sleepMin = 500;
const sleepMax = 1000;

// 从微信读书直接导出的笔记
const ankiOrigin = "anki_origin.txt";
// 读取 ankiOrigin 内容并向anki添加时报了错，将剩余内容写入了anki_remian.json
const ankiReamin = "anki_remain.json";
// 自定义的笔记，格式为 module.exports = ['xxx', { f: 'yyy', b: 'zzz' }]
const ankiCustom = "anki_custom.js"

const originPath= path.resolve(__dirname, ankiOrigin);
const remainPath = path.resolve(__dirname, ankiReamin);
const customPath = path.resolve(__dirname, ankiCustom);

const defaultBackSide = "啊";

const contentSet = new Set();

prompt(deckMap);
