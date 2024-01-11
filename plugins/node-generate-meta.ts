/**
 * 通过 pnpm meta xxx 执行
 * 传入文件夹自动生成_meta.json
 */

import fs from "fs";
import path from "path";

const main = (dir: string, recursion = false) => {

  if (!dir) throw new Error("必须传文件路径");

  dir = path.resolve(dir);

  if (!fs.existsSync(dir)) throw new Error("文件路径不存在");

  if (!fs.statSync(dir).isDirectory()) throw new Error("传入文件夹路径");

  const reg = /---.+---/gs;
  const regSuff = /\.md|\.mdx/;
  const ignores = [];

  const result = fs.readdirSync(dir).reduce((res, file) => {
    const filePath = path.resolve(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      const name = path.basename(filePath)
      res[name] = {
        type: "dir",
        name,
        label: name,
        collapsed: true
      }
      recursion && main(filePath, true)
      return res;
    }

    // 只接受md和mdx
    if (!regSuff.test(file)) {
      ignores.push(file);
      return res;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const result = Array.from(content.matchAll(reg));

    const match = result[0];
    const meta = {
      type: "file",
      name: file.split(".")[0],
    };
    // 文件meta中没有label, 使用文件名
    if (!match) {
      res[meta.name] = {
        ...meta,
        label: meta.name,
      };
      return res;
    }

    const titleMeta = match[0].replace(/-/gm, "");

    let sidebarLabel;
    titleMeta.split(/\s?\n/).forEach((item) => {
      if (!item) return;
      const map = item.split(":").map((v) => v.trim());
      const [label, value] = map;
      if (label === "label") {
        sidebarLabel = value;
      }
    });
    res[meta.name] = {
      ...meta,
      label: sidebarLabel,
    };
    return res;
  }, {});

  const sortrc = path.resolve(dir, "sortrc");
  if (!sortrc) {
    throw new Error("缺少sortrc");
  }

  const sorts = fs.readFileSync(sortrc, "utf-8").split("\n").filter(Boolean);
  const overview = sorts.map((s) => result[s.trim()]);

  const metaPath = path.resolve(dir, "_meta.json");
  const space = " ".repeat(4);

  fs.writeFileSync(metaPath, JSON.stringify(overview, null, 2));
  console.log(`
  ${dir}:
  成功生成_meta.json
  
  以下文件被忽略:
${space}- ${ignores.join(`\n${space}- `)}

---------------------------------------- `);
};

const argv = process.argv.slice(2);
const [dir, r] = argv;
const recursion = r === '-r'
main(dir, recursion);
