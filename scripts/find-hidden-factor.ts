// 隠れた要因を探す
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findHiddenFactor() {
  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .not('score_problem', 'is', null)
    .limit(2000);

  if (error || !data) return;

  console.log('=== 隠れた要因を探す ===\n');
  console.log(`総データ数: ${data.length}\n`);

  // 1. ケースIDごとにルールが違うか？
  console.log('【1. ケースIDごとの分析】\n');

  const byCaseId = new Map<string, any[]>();
  for (const d of data) {
    if (!byCaseId.has(d.case_id)) {
      byCaseId.set(d.case_id, []);
    }
    byCaseId.get(d.case_id)!.push(d);
  }

  console.log(`ケース数: ${byCaseId.size}\n`);

  for (const [caseId, items] of byCaseId.entries()) {
    console.log(`ケース ${caseId}: ${items.length}件`);
  }

  // 2. 問題把握: ケースごとに計算式が違うか確認
  console.log('\n\n【2. ケースごとの問題把握計算式】\n');

  const childFields = [
    'detail_problem_understanding',
    'detail_problem_essence',
    'detail_problem_maintenance_biz',
    'detail_problem_maintenance_hr',
    'detail_problem_reform_biz',
    'detail_problem_reform_hr'
  ];

  for (const [caseId, items] of byCaseId.entries()) {
    const valid = items.filter(d =>
      d.score_problem != null &&
      childFields.every(f => d[f] != null)
    );

    if (valid.length < 10) continue;

    // 各計算式の一致率をケースごとに計算
    let matchRound = 0;
    let matchFloor = 0;
    let matchFormula = 0;

    for (const d of valid) {
      const sum = childFields.reduce((acc, f) => acc + d[f], 0);
      const raw = (sum / 6 / 4) * 5;

      const rounded = Math.round(raw / 0.5) * 0.5;
      const floored = Math.floor(raw / 0.5) * 0.5;

      // 条件付きルール
      let formula;
      if (d.detail_problem_understanding >= 3 &&
          d.detail_problem_essence < d.detail_problem_understanding) {
        formula = floored;
      } else {
        formula = rounded;
      }

      if (Math.abs(rounded - d.score_problem) < 0.01) matchRound++;
      if (Math.abs(floored - d.score_problem) < 0.01) matchFloor++;
      if (Math.abs(formula - d.score_problem) < 0.01) matchFormula++;
    }

    console.log(`ケース ${caseId} (${valid.length}件):`);
    console.log(`  四捨五入: ${(matchRound / valid.length * 100).toFixed(1)}%`);
    console.log(`  切り捨て: ${(matchFloor / valid.length * 100).toFixed(1)}%`);
    console.log(`  条件付き: ${(matchFormula / valid.length * 100).toFixed(1)}%`);
  }

  // 3. 同じ子スコアで親が違うケースを詳しく見る
  console.log('\n\n【3. 同じ子スコアで親スコアが異なるケースの詳細】\n');

  const problemValid = data.filter(d =>
    d.score_problem != null &&
    childFields.every(f => d[f] != null)
  );

  const byChildPattern = new Map<string, any[]>();
  for (const d of problemValid) {
    const pattern = childFields.map(f => d[f]).join(',');
    if (!byChildPattern.has(pattern)) {
      byChildPattern.set(pattern, []);
    }
    byChildPattern.get(pattern)!.push(d);
  }

  // 複数の親スコアがあるパターンを抽出
  const conflictPatterns: { pattern: string; items: any[] }[] = [];
  for (const [pattern, items] of byChildPattern.entries()) {
    const uniqueParents = new Set(items.map(i => i.score_problem));
    if (uniqueParents.size > 1) {
      conflictPatterns.push({ pattern, items });
    }
  }

  console.log(`矛盾するパターン数: ${conflictPatterns.length}\n`);

  // 上位の矛盾パターンを詳しく分析
  conflictPatterns.sort((a, b) => b.items.length - a.items.length);

  for (const { pattern, items } of conflictPatterns.slice(0, 10)) {
    console.log(`\nパターン [${pattern}]:`);

    // 親スコアごとにグループ化
    const byParent = new Map<number, any[]>();
    for (const item of items) {
      if (!byParent.has(item.score_problem)) {
        byParent.set(item.score_problem, []);
      }
      byParent.get(item.score_problem)!.push(item);
    }

    for (const [parent, parentItems] of Array.from(byParent.entries()).sort((a, b) => a[0] - b[0])) {
      console.log(`  親=${parent}: ${parentItems.length}件`);

      // ケースIDの分布
      const caseIds = new Map<string, number>();
      for (const item of parentItems) {
        caseIds.set(item.case_id, (caseIds.get(item.case_id) || 0) + 1);
      }
      const caseIdStr = Array.from(caseIds.entries()).map(([c, n]) => `${c}(${n})`).join(', ');
      console.log(`    ケース: ${caseIdStr}`);

      // 他のスコアの傾向
      const avgRole = parentItems.reduce((a, d) => a + (d.score_role || 0), 0) / parentItems.length;
      const avgSol = parentItems.reduce((a, d) => a + (d.score_solution || 0), 0) / parentItems.length;
      console.log(`    平均(役割理解=${avgRole.toFixed(2)}, 対策立案=${avgSol.toFixed(2)})`);
    }
  }

  // 4. 連携の矛盾パターンも確認
  console.log('\n\n【4. 連携の矛盾パターン】\n');

  const collabFields = ['detail_collab_supervisor', 'detail_collab_external', 'detail_collab_member'];
  const collabValid = data.filter(d =>
    d.score_collaboration != null &&
    collabFields.every(f => d[f] != null)
  );

  const byCollabPattern = new Map<string, any[]>();
  for (const d of collabValid) {
    const pattern = collabFields.map(f => d[f]).join(',');
    if (!byCollabPattern.has(pattern)) {
      byCollabPattern.set(pattern, []);
    }
    byCollabPattern.get(pattern)!.push(d);
  }

  const collabConflicts: { pattern: string; items: any[] }[] = [];
  for (const [pattern, items] of byCollabPattern.entries()) {
    const uniqueParents = new Set(items.map(i => i.score_collaboration));
    if (uniqueParents.size > 1) {
      collabConflicts.push({ pattern, items });
    }
  }

  console.log(`矛盾するパターン数: ${collabConflicts.length}\n`);

  for (const { pattern, items } of collabConflicts.slice(0, 5)) {
    console.log(`パターン [${pattern}]:`);
    const parents = new Map<number, number>();
    for (const item of items) {
      parents.set(item.score_collaboration, (parents.get(item.score_collaboration) || 0) + 1);
    }
    const parentStr = Array.from(parents.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([p, n]) => `${p}(${n}件)`)
      .join(', ');
    console.log(`  親スコア: ${parentStr}`);
  }

  // 5. もしかして：人が違う？
  console.log('\n\n【5. response_idのパターン分析】\n');

  // response_idの先頭文字で分類
  const byPrefix = new Map<string, any[]>();
  for (const d of problemValid) {
    const prefix = d.response_id?.substring(0, 1) || 'unknown';
    if (!byPrefix.has(prefix)) {
      byPrefix.set(prefix, []);
    }
    byPrefix.get(prefix)!.push(d);
  }

  for (const [prefix, items] of byPrefix.entries()) {
    let matchRound = 0;
    let matchFloor = 0;

    for (const d of items) {
      const sum = childFields.reduce((acc, f) => acc + d[f], 0);
      const raw = (sum / 6 / 4) * 5;
      const rounded = Math.round(raw / 0.5) * 0.5;
      const floored = Math.floor(raw / 0.5) * 0.5;

      if (Math.abs(rounded - d.score_problem) < 0.01) matchRound++;
      if (Math.abs(floored - d.score_problem) < 0.01) matchFloor++;
    }

    console.log(`prefix="${prefix}" (${items.length}件): 四捨五入=${(matchRound / items.length * 100).toFixed(1)}%, 切り捨て=${(matchFloor / items.length * 100).toFixed(1)}%`);
  }
}

findHiddenFactor().catch(console.error);
