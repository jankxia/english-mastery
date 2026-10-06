/* english-mastery · 人教版课程主线（学习地图）
 * 以「人教版 PEP（三年级起点）」为线，把现有全部学习方法串起来。
 * 课程树直接从 window.WORD_BANK.primary.units 的 id 推导：
 *   p-sh{g}{v}-u{n}  →  {g}年级 {v:上册/下册} Unit {n}
 *   p-core / p-animals ... → 「基础与主题」专区
 * 这样词库一改，课程树自动跟着改，不用手维护 96 个单元。
 */
(function () {
  "use strict";

  var units = (window.WORD_BANK && window.WORD_BANK.primary && window.WORD_BANK.primary.units) || [];

  var grades = {};   // "3" -> { grade, label, volumes:{ a:{key,label,units:[]}, b:{...} } }
  var basics = [];

  units.forEach(function (u) {
    var m = /^p-sh(\d)([ab])-u(\d+)$/.exec(u.id);
    if (m) {
      var g = m[1], v = m[2], n = parseInt(m[3], 10);
      if (!grades[g]) {
        grades[g] = {
          grade: g,
          label: g + "年级",
          volumes: {
            a: { key: "a", label: "上册", units: [] },
            b: { key: "b", label: "下册", units: [] }
          }
        };
      }
      grades[g].volumes[v].units.push({ unitId: u.id, title: u.title, num: n });
    } else {
      basics.push({ unitId: u.id, title: u.title });
    }
  });

  // 每册单元按 Unit 序号排序
  Object.keys(grades).forEach(function (g) {
    ["a", "b"].forEach(function (v) {
      grades[g].volumes[v].units.sort(function (x, y) { return x.num - y.num; });
    });
  });

  var gList = Object.keys(grades)
    .sort(function (a, b) { return (+a) - (+b); })
    .map(function (k) { return grades[k]; });

  window.CURRICULUM = { grades: gList, basics: basics };
})();
