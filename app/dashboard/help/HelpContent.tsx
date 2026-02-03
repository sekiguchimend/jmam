"use client";

import { useState } from "react";
import {
  Calculator,
  FileText,
  Home,
  MessageSquare,
  Search,
  Target,
  TrendingUp,
  User,
} from "lucide-react";

type Section =
  | "overview"
  | "score-predict"
  | "new-case-predict"
  | "predict"
  | "profile"
  | "scoring-guide";

export default function HelpContent() {
  const [activeSection, setActiveSection] = useState<Section>("overview");

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* ヘッダー */}
      <div className="mb-6 lg:mb-8">
        <h1 className="text-xl lg:text-2xl font-black mb-1" style={{ color: "#323232" }}>
          使い方ガイド
        </h1>
        <p className="text-sm lg:text-base font-bold" style={{ color: "#323232" }}>
          スコア予測システムの各機能の使い方を説明します
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* サイドバーナビゲーション */}
        <div className="lg:col-span-1">
          <div className="p-4 rounded-lg sticky top-6" style={{ background: "#fff" }}>
            <h2 className="text-sm font-black mb-3" style={{ color: "var(--text-muted)" }}>
              目次
            </h2>
            <nav className="space-y-1">
              <NavItem
                icon={<Home className="w-4 h-4" />}
                label="システム概要"
                active={activeSection === "overview"}
                onClick={() => setActiveSection("overview")}
              />
              <NavItem
                icon={<Calculator className="w-4 h-4" />}
                label="スコア予測"
                active={activeSection === "score-predict"}
                onClick={() => setActiveSection("score-predict")}
              />
              <NavItem
                icon={<Search className="w-4 h-4" />}
                label="新規ケース予測"
                active={activeSection === "new-case-predict"}
                onClick={() => setActiveSection("new-case-predict")}
              />
              <NavItem
                icon={<TrendingUp className="w-4 h-4" />}
                label="スコア参照"
                active={activeSection === "predict"}
                onClick={() => setActiveSection("predict")}
              />
              <NavItem
                icon={<User className="w-4 h-4" />}
                label="プロフィール"
                active={activeSection === "profile"}
                onClick={() => setActiveSection("profile")}
              />
              <NavItem
                icon={<Target className="w-4 h-4" />}
                label="スコア評価基準"
                active={activeSection === "scoring-guide"}
                onClick={() => setActiveSection("scoring-guide")}
              />
            </nav>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="lg:col-span-3">
          <div className="p-4 lg:p-6">
            {activeSection === "overview" && <OverviewSection />}
            {activeSection === "score-predict" && <ScorePredictSection />}
            {activeSection === "new-case-predict" && <NewCasePredictSection />}
            {activeSection === "predict" && <PredictSection />}
            {activeSection === "profile" && <ProfileSection />}
            {activeSection === "scoring-guide" && <ScoringGuideSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ナビゲーションアイテム
function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
      style={{
        color: active ? "var(--primary)" : "#666",
        fontWeight: active ? "bold" : "normal",
      }}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}

// システム概要セクション
function OverviewSection() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-3" style={{ color: "#1a1a1a" }}>
          システム概要
        </h2>
        <p className="text-base leading-relaxed" style={{ color: "#666" }}>
          ケーススタディに対する解答を評価し、スコアを予測するAI支援システムです。
          過去の解答データとAI分析を組み合わせて、より正確なスコア予測を提供します。
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold mb-3" style={{ color: "#1a1a1a" }}>主な機能</h3>
        <FeatureCard
          icon={<Calculator className="w-5 h-5" style={{ color: "var(--primary)" }} />}
          title="スコア予測"
          description="既存のケースに対する解答のスコアを予測します。類似解答との比較とAI分析により、6つの主要スコアと15の詳細スコアを算出します。"
        />
        <FeatureCard
          icon={<Search className="w-5 h-5" style={{ color: "var(--primary)" }} />}
          title="新規ケース予測"
          description="新しいシチュエーションを入力して、類似ケースを見つけながらスコアを予測します。未知の状況でも過去の類似事例から学習します。"
        />
        <FeatureCard
          icon={<TrendingUp className="w-5 h-5" style={{ color: "var(--primary)" }} />}
          title="スコア参照"
          description="過去の解答とそのスコアを確認できます。学習や参考資料として活用できます。"
        />
      </div>

      <div className="border-l-4 pl-4" style={{ borderColor: "#ddd" }}>
        <h3 className="text-base font-bold mb-2" style={{ color: "#1a1a1a" }}>
          評価される6つの主要スコア
        </h3>
        <ul className="text-sm space-y-1.5 leading-relaxed" style={{ color: "#666" }}>
          <li><strong style={{ color: "#1a1a1a" }}>問題把握</strong> - 状況の理解と問題の本質把握</li>
          <li><strong style={{ color: "#1a1a1a" }}>対策立案</strong> - 具体的な解決策の立案</li>
          <li><strong style={{ color: "#1a1a1a" }}>役割理解</strong> - 自身の役割の認識</li>
          <li><strong style={{ color: "#1a1a1a" }}>主導</strong> - リーダーシップと主体性</li>
          <li><strong style={{ color: "#1a1a1a" }}>連携</strong> - 関係者との協力</li>
          <li><strong style={{ color: "#1a1a1a" }}>育成</strong> - メンバーの成長支援</li>
        </ul>
      </div>
    </div>
  );
}

// スコア予測セクション
function ScorePredictSection() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-3" style={{ color: "#1a1a1a" }}>
          スコア予測の使い方
        </h2>
        <p className="text-base leading-relaxed" style={{ color: "#666" }}>
          既存のケースに対する解答を入力して、スコアを予測します。
        </p>
      </div>

      <StepByStep
        steps={[
          {
            title: "ケースを選択",
            description: "ドロップダウンから評価したいケースを選択します。",
            icon: <FileText className="w-5 h-5" />,
          },
          {
            title: "設問1（問題把握）に解答",
            description: "「どのような問題があるか」という設問に対して、状況分析と問題の本質を記述します。",
            icon: <MessageSquare className="w-5 h-5" />,
          },
          {
            title: "設問2（対策立案）に解答",
            description: "「どのように対応するか」という設問に対して、具体的な対策と実行計画を記述します。",
            icon: <MessageSquare className="w-5 h-5" />,
          },
          {
            title: "予測を実行",
            description: "「スコアを予測」ボタンをクリックすると、AI分析と類似解答の比較が行われます。",
            icon: <Calculator className="w-5 h-5" />,
          },
        ]}
      />

      <div className="space-y-4">
        <h3 className="text-lg font-bold" style={{ color: "#1a1a1a" }}>
          予測結果の見方
        </h3>

        <ResultCard
          title="主要スコア（6項目）"
          items={[
            "問題把握、対策立案、役割理解、主導、連携、育成の6つのスコアが表示されます",
            "各スコアは1.0〜5.0の範囲で評価されます",
            "色付きで強調されたスコアが最も重要な評価項目です",
          ]}
        />

        <ResultCard
          title="詳細スコア（15項目）"
          items={[
            "問題把握の詳細（状況理解、本質把握、維持管理・改革の各観点）",
            "対策立案の詳細（網羅性、計画性、維持管理・改革の各観点）",
            "連携の詳細（上司、職場外、メンバーとの連携）",
            "各詳細スコアは1〜4の範囲で評価されます",
          ]}
        />

        <ResultCard
          title="信頼度"
          items={[
            "予測の信頼性を示すパーセンテージです",
            "類似解答の数や類似度によって変動します",
            "高い信頼度（70%以上）の予測はより正確です",
          ]}
        />

        <ResultCard
          title="類似解答例"
          items={[
            "予測に使用された類似解答が表示されます",
            "類似度とスコアを参考にして、自分の解答を改善できます",
            "コメントがある場合は評価者のフィードバックも確認できます",
          ]}
        />
      </div>

      <div className="border-l-4 pl-4" style={{ borderColor: "#ddd" }}>
        <h3 className="text-base font-semibold mb-2" style={{ color: "#1a1a1a" }}>
          ポイント
        </h3>
        <ul className="text-sm space-y-1.5 leading-relaxed ml-4" style={{ color: "#666" }}>
          <li className="list-disc">詳細で具体的な解答ほど、より正確なスコア予測が得られます</li>
          <li className="list-disc">類似解答例を参考にして、評価されやすい解答の特徴を学びましょう</li>
          <li className="list-disc">設問1と設問2は別々に予測されますが、両方を入力することで総合的な評価が可能です</li>
        </ul>
      </div>
    </div>
  );
}

// 新規ケース予測セクション
function NewCasePredictSection() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-3" style={{ color: "#1a1a1a" }}>
          新規ケース予測の使い方
        </h2>
        <p className="text-base leading-relaxed" style={{ color: "#666" }}>
          新しいシチュエーションを入力して、類似ケースからスコアを予測します。
        </p>
      </div>

      <StepByStep
        steps={[
          {
            title: "シチュエーションを入力",
            description: "新しいケースの状況を詳細に記述します。職場の状況、課題、関係者などを含めます。",
            icon: <FileText className="w-5 h-5" />,
          },
          {
            title: "設問1（問題把握）に解答",
            description: "入力したシチュエーションに対して、どのような問題があるかを分析します。",
            icon: <MessageSquare className="w-5 h-5" />,
          },
          {
            title: "設問2（対策立案）に解答",
            description: "問題に対してどのように対応するかを記述します。",
            icon: <MessageSquare className="w-5 h-5" />,
          },
          {
            title: "予測を実行",
            description: "システムが類似ケースを検索し、そのケースの解答データからスコアを予測します。",
            icon: <Search className="w-5 h-5" />,
          },
        ]}
      />

      <div className="space-y-4">
        <h3 className="text-lg font-bold" style={{ color: "#1a1a1a" }}>
          新規ケース予測の特徴
        </h3>

        <ResultCard
          title="類似ケース検索"
          items={[
            "入力したシチュエーションから、最も類似する過去のケースを検索します",
            "複数の類似ケースが見つかった場合、それらを総合的に分析します",
            "類似度が表示されるので、予測の妥当性を判断できます",
          ]}
        />

        <ResultCard
          title="クロスケース予測"
          items={[
            "複数のケースにまたがって類似解答を検索します",
            "より広範なデータから予測を行うため、精度が向上します",
            "未知の状況でも、類似した要素を持つケースから学習します",
          ]}
        />

        <ResultCard
          title="予測結果の活用"
          items={[
            "類似ケースの名前と類似度が表示されます",
            "参考となる解答例を確認できます",
            "自分の解答が類似ケースと比較してどう評価されるか理解できます",
          ]}
        />
      </div>

      <div className="border-l-4 pl-4" style={{ borderColor: "#ddd" }}>
        <h3 className="text-base font-semibold mb-2" style={{ color: "#1a1a1a" }}>
          効果的な使い方
        </h3>
        <ul className="text-sm space-y-1.5 leading-relaxed ml-4" style={{ color: "#666" }}>
          <li className="list-disc">シチュエーションは具体的に記述しましょう（組織規模、業種、具体的な状況など）</li>
          <li className="list-disc">類似ケースの名前を確認し、そのケースの特徴を理解しましょう</li>
          <li className="list-disc">信頼度が低い場合は、シチュエーションの記述を追加・修正してみましょう</li>
        </ul>
      </div>
    </div>
  );
}

// スコア参照セクション
function PredictSection() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-3" style={{ color: "#1a1a1a" }}>
          スコア参照の使い方
        </h2>
        <p className="text-base leading-relaxed" style={{ color: "#666" }}>
          過去の解答とそのスコアを確認できます。学習や参考資料として活用しましょう。
        </p>
      </div>

      <StepByStep
        steps={[
          {
            title: "ケースを選択",
            description: "参照したいケースをドロップダウンから選択します。",
            icon: <FileText className="w-5 h-5" />,
          },
          {
            title: "設問を選択",
            description: "設問1（問題把握）または設問2（対策立案）を選択します。",
            icon: <MessageSquare className="w-5 h-5" />,
          },
          {
            title: "解答とスコアを確認",
            description: "過去の解答内容と、それに対する評価スコアが表示されます。",
            icon: <TrendingUp className="w-5 h-5" />,
          },
        ]}
      />

      <div className="space-y-4">
        <h3 className="text-lg font-bold" style={{ color: "#1a1a1a" }}>
          活用方法
        </h3>

        <ResultCard
          title="高評価の解答を学ぶ"
          items={[
            "スコアが高い解答の特徴を分析しましょう",
            "問題の捉え方、対策の立て方の参考にできます",
            "評価コメントがある場合は、評価ポイントを確認できます",
          ]}
        />

        <ResultCard
          title="自分の解答と比較"
          items={[
            "同じケースに対する他の解答と比較できます",
            "不足している観点や改善点を見つけられます",
            "表現方法や構成の参考になります",
          ]}
        />
      </div>
    </div>
  );
}

// プロフィールセクション
function ProfileSection() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-3" style={{ color: "#1a1a1a" }}>
          プロフィール設定
        </h2>
        <p className="text-base leading-relaxed" style={{ color: "#666" }}>
          表示名の変更やパスワードの更新ができます。
        </p>
      </div>

      <div className="space-y-4">
        <ResultCard
          title="表示名の変更"
          items={[
            "システム上で表示される名前を設定できます",
            "変更後は即座に反映されます",
          ]}
        />

        <ResultCard
          title="パスワード変更"
          items={[
            "セキュリティのため、定期的なパスワード変更を推奨します",
            "現在のパスワードと新しいパスワードを入力します",
          ]}
        />
      </div>
    </div>
  );
}

// スコア評価基準セクション
function ScoringGuideSection() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-3" style={{ color: "#1a1a1a" }}>
          スコア評価基準
        </h2>
        <p className="text-base leading-relaxed" style={{ color: "#666" }}>
          各スコア項目の評価基準を理解しましょう。
        </p>
      </div>

      <div className="space-y-4">
        <ScoreGuideCard
          title="問題把握（上限5.0点、刻み0.5点）"
          criteria={[
            "状況理解: 職場の状況を正確に把握できているか",
            "本質把握: 問題の根本原因を見抜けているか",
            "維持管理の観点: 現状維持・改善の視点があるか",
            "改革の観点: 抜本的な変革の視点があるか",
          ]}
        />

        <ScoreGuideCard
          title="対策立案（上限5.0点、刻み0.5点）"
          criteria={[
            "網羅性: 多角的な対策を検討できているか",
            "計画性: 具体的な実行計画があるか",
            "維持管理の観点: 日常業務での対応策があるか",
            "改革の観点: 構造的な改善策があるか",
          ]}
        />

        <ScoreGuideCard
          title="役割理解（上限5.0点、刻み0.1点）"
          criteria={[
            "自身の立場・役割を正しく認識しているか",
            "権限と責任の範囲を理解しているか",
            "組織における位置づけを把握しているか",
          ]}
        />

        <ScoreGuideCard
          title="主導（上限4.0点、刻み0.5点）"
          criteria={[
            "リーダーシップを発揮しているか",
            "主体的に行動する姿勢があるか",
            "チームを牽引する意識があるか",
          ]}
        />

        <ScoreGuideCard
          title="連携（上限4.0点、刻み0.5点）"
          criteria={[
            "上司との連携: 報告・相談ができているか",
            "職場外との連携: 他部署・外部との協力体制があるか",
            "メンバーとの連携: チーム内のコミュニケーションが取れているか",
          ]}
        />

        <ScoreGuideCard
          title="育成（上限4.0点、刻み0.5点）"
          criteria={[
            "メンバーの成長を支援する視点があるか",
            "指導・助言の機会を設けているか",
            "人材育成の重要性を認識しているか",
          ]}
        />
      </div>

      <div className="border-l-4 pl-4" style={{ borderColor: "#ddd" }}>
        <h3 className="text-base font-semibold mb-2" style={{ color: "#1a1a1a" }}>
          評価のポイント
        </h3>
        <ul className="text-sm space-y-1.5 leading-relaxed ml-4" style={{ color: "#666" }}>
          <li className="list-disc"><strong style={{ color: "#1a1a1a" }}>具体性</strong> - 抽象的な表現ではなく、具体的な行動や施策を記述する</li>
          <li className="list-disc"><strong style={{ color: "#1a1a1a" }}>実現可能性</strong> - 現実的で実行可能な内容である</li>
          <li className="list-disc"><strong style={{ color: "#1a1a1a" }}>多面性</strong> - 業務面・人的面の両方を考慮している</li>
          <li className="list-disc"><strong style={{ color: "#1a1a1a" }}>時間軸</strong> - 短期・中長期の視点を持っている</li>
          <li className="list-disc"><strong style={{ color: "#1a1a1a" }}>影響範囲</strong> - 個人・チーム・組織への影響を考えている</li>
        </ul>
      </div>
    </div>
  );
}

// 共通コンポーネント
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex-shrink-0 mt-0.5" style={{ color: "#666" }}>{icon}</div>
      <div>
        <h4 className="text-base font-semibold mb-1" style={{ color: "#1a1a1a" }}>
          {title}
        </h4>
        <p className="text-sm leading-relaxed" style={{ color: "#666" }}>
          {description}
        </p>
      </div>
    </div>
  );
}

function StepByStep({ steps }: { steps: Array<{ title: string; description: string; icon: React.ReactNode }> }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold mb-3" style={{ color: "#1a1a1a" }}>
        使い方の手順
      </h3>
      {steps.map((step, index) => (
        <div key={index} className="flex items-start gap-3 py-2">
          <div
            className="flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 text-sm font-semibold"
            style={{ background: "#666", color: "#fff" }}
          >
            {index + 1}
          </div>
          <div className="flex-1">
            <h4 className="text-base font-semibold mb-1" style={{ color: "#1a1a1a" }}>
              {step.title}
            </h4>
            <p className="text-sm leading-relaxed" style={{ color: "#666" }}>
              {step.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="py-2">
      <h4 className="text-base font-semibold mb-2" style={{ color: "#1a1a1a" }}>
        {title}
      </h4>
      <ul className="text-sm space-y-1.5 leading-relaxed ml-4" style={{ color: "#666" }}>
        {items.map((item, index) => (
          <li key={index} className="list-disc">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ScoreGuideCard({ title, criteria }: { title: string; criteria: string[] }) {
  return (
    <div className="py-3">
      <h4 className="text-base font-semibold mb-2" style={{ color: "#1a1a1a" }}>
        {title}
      </h4>
      <ul className="text-sm space-y-1.5 leading-relaxed ml-4" style={{ color: "#666" }}>
        {criteria.map((criterion, index) => (
          <li key={index} className="list-disc">{criterion}</li>
        ))}
      </ul>
    </div>
  );
}
