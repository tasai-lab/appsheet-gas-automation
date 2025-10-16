"""
Gemini API統一化とモデル最適化ツール

機能:
1. API Keyの統一（AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY）
2. モデル選択の最適化
   - 複雑な思考が必要: gemini-1.5-pro
   - 軽量タスク: gemini-2.5-flash
"""

import re
from pathlib import Path
from typing import Dict, List, Set
from dataclasses import dataclass


@dataclass
class GeminiConfig:
    """Gemini API設定"""
    project_name: str
    recommended_model: str  # 'pro' or 'flash'
    reason: str
    files_to_update: List[Path]
    current_api_keys: Set[str]
    current_models: Set[str]


class GeminiAPIOptimizer:
    """Gemini API最適化ツール"""
    
    # 統一API Key
    UNIFIED_API_KEY = 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY'
    
    # 複雑な思考が必要なプロジェクト（Pro推奨）
    PRO_KEYWORDS = [
        '要約', '通話', '看護記録', '精神科', '質疑応答',
        '報告書', 'レポート', '新規依頼'
    ]
    
    # Flash推奨プロジェクト
    FLASH_KEYWORDS = [
        'OCR', '仕分け', '取り込み', '上書き', '反映',
        '作成', '更新', 'スレッド'
    ]
    
    def __init__(self, projects_dir: Path):
        self.projects_dir = projects_dir
    
    def analyze_all_projects(self) -> List[GeminiConfig]:
        """全プロジェクトを分析"""
        results = []
        
        for project_dir in self.projects_dir.iterdir():
            if not project_dir.is_dir():
                continue
            
            config = self._analyze_project(project_dir)
            if config:
                results.append(config)
        
        return results
    
    def _analyze_project(self, project_dir: Path) -> GeminiConfig:
        """単一プロジェクトを分析"""
        scripts_dir = project_dir / 'scripts'
        if not scripts_dir.exists():
            return None
        
        files_to_update = []
        current_api_keys = set()
        current_models = set()
        has_gemini = False
        
        # スクリプトファイルをチェック
        for script_file in scripts_dir.glob('*.gs'):
            try:
                content = script_file.read_text(encoding='utf-8', errors='ignore')
                
                # Gemini API使用チェック
                if 'generativelanguage.googleapis.com' in content or 'gemini' in content.lower():
                    has_gemini = True
                    files_to_update.append(script_file)
                    
                    # 現在のAPI Key抽出
                    api_key_matches = re.findall(
                        r'AIza[A-Za-z0-9_-]{35}',
                        content
                    )
                    current_api_keys.update(api_key_matches)
                    
                    # 現在のモデル抽出
                    model_matches = re.findall(
                        r'gemini-(?:1\.5-)?(?:pro|flash)(?:-\d+\.\d+)?',
                        content,
                        re.IGNORECASE
                    )
                    current_models.update(model_matches)
            
            except Exception as e:
                print(f"Error reading {script_file}: {e}")
        
        if not has_gemini:
            return None
        
        # 推奨モデル判定
        recommended_model, reason = self._determine_model(project_dir.name)
        
        return GeminiConfig(
            project_name=project_dir.name,
            recommended_model=recommended_model,
            reason=reason,
            files_to_update=files_to_update,
            current_api_keys=current_api_keys,
            current_models=current_models
        )
    
    def _determine_model(self, project_name: str) -> tuple:
        """プロジェクト名から推奨モデルを判定"""
        # Pro推奨チェック
        for keyword in self.PRO_KEYWORDS:
            if keyword in project_name:
                return ('pro', f'複雑な思考が必要（{keyword}）')
        
        # Flash推奨チェック
        for keyword in self.FLASH_KEYWORDS:
            if keyword in project_name:
                return ('flash', f'軽量タスク（{keyword}）')
        
        # デフォルトはFlash
        return ('flash', 'デフォルト（軽量タスク）')
    
    def update_project(self, config: GeminiConfig, dry_run: bool = False) -> Dict:
        """プロジェクトを更新"""
        stats = {
            'files_updated': 0,
            'api_keys_replaced': 0,
            'models_changed': 0,
            'errors': []
        }
        
        target_model = 'gemini-2.5-pro' if config.recommended_model == 'pro' else 'gemini-2.5-flash'
        
        for file_path in config.files_to_update:
            try:
                content = file_path.read_text(encoding='utf-8')
                original_content = content
                
                # API Key置換
                for old_key in config.current_api_keys:
                    if old_key != self.UNIFIED_API_KEY:
                        content = content.replace(old_key, self.UNIFIED_API_KEY)
                        stats['api_keys_replaced'] += 1
                
                # モデル名置換
                # パターン1: gemini-pro, gemini-1.5-pro, gemini-2.5-pro など
                content = re.sub(
                    r'gemini-(?:1\.5-|2\.0-)?pro(?:-\d+\.\d+)?',
                    target_model if config.recommended_model == 'pro' else target_model,
                    content,
                    flags=re.IGNORECASE
                )
                
                # パターン2: gemini-flash, gemini-1.5-flash, gemini-2.5-flash など
                content = re.sub(
                    r'gemini-(?:1\.5-|2\.0-)?flash(?:-\d+\.\d+)?',
                    target_model,
                    content,
                    flags=re.IGNORECASE
                )
                
                if content != original_content:
                    stats['models_changed'] += 1
                    
                    if not dry_run:
                        # バックアップ作成
                        backup_path = file_path.with_suffix('.gs.backup')
                        if not backup_path.exists():
                            file_path.write_text(original_content, encoding='utf-8')
                            backup_path.write_text(original_content, encoding='utf-8')
                        
                        # 更新
                        file_path.write_text(content, encoding='utf-8')
                        stats['files_updated'] += 1
                
            except Exception as e:
                stats['errors'].append(f"{file_path.name}: {str(e)}")
        
        return stats
    
    def generate_summary_report(self, configs: List[GeminiConfig]) -> str:
        """サマリーレポート生成"""
        total = len(configs)
        pro_count = len([c for c in configs if c.recommended_model == 'pro'])
        flash_count = len([c for c in configs if c.recommended_model == 'flash'])
        
        # API Key統計
        all_keys = set()
        for config in configs:
            all_keys.update(config.current_api_keys)
        
        report = f"""
# Gemini API統一化・最適化レポート

## サマリー

- **総プロジェクト数**: {total}
- **gemini-2.5-pro推奨**: {pro_count}プロジェクト
- **gemini-2.5-flash推奨**: {flash_count}プロジェクト
- **現在のAPI Key数**: {len(all_keys)}種類 → **1種類に統一**
- **統一API Key**: `{self.UNIFIED_API_KEY}`

## モデル割り当て

### 🔵 gemini-2.5-pro（複雑な思考が必要）

"""
        for config in configs:
            if config.recommended_model == 'pro':
                report += f"- **{config.project_name}**\n"
                report += f"  - 理由: {config.reason}\n"
                report += f"  - 更新ファイル数: {len(config.files_to_update)}\n"
        
        report += f"\n### ⚡ gemini-2.5-flash（軽量・高速）\n\n"
        
        for config in configs:
            if config.recommended_model == 'flash':
                report += f"- **{config.project_name}**\n"
                report += f"  - 理由: {config.reason}\n"
                report += f"  - 更新ファイル数: {len(config.files_to_update)}\n"
        
        report += f"""

## 現在のAPI Key状況

検出されたAPI Key:
"""
        for i, key in enumerate(sorted(all_keys), 1):
            is_target = '✓ (統一Key)' if key == self.UNIFIED_API_KEY else '→ 置換対象'
            report += f"{i}. `{key}` {is_target}\n"
        
        report += f"""

## モデル選択基準

### gemini-2.5-pro を使用すべきケース:
- 通話要約生成（音声→テキスト→要約）
- 看護記録作成（音声→構造化データ）
- 精神科記録（デリケートな内容理解）
- 質疑応答（文脈理解と推論）
- レポート生成（複数情報の統合）
- 新規依頼作成（複雑な判断）

### gemini-2.5-flash を使用すべきケース:
- OCR処理（画像→テキスト）
- 書類仕分け（分類タスク）
- 名刺取り込み（定型情報抽出）
- データ上書き・反映（単純変換）
- スレッド更新（軽量処理）
- 基本情報作成（テンプレート処理）

## コスト影響

### 料金（2024-2025年価格）

| モデル | 入力 | 出力 | 用途 |
|--------|------|------|------|
| gemini-2.5-pro | $0.00025/1K文字 | $0.0005/1K文字 | 複雑タスク |
| gemini-2.5-flash | **$0.000075/1K文字** | **$0.00015/1K文字** | 軽量タスク |

**Flash使用で約70%コスト削減！** ⚡

## 期待効果

1. **コスト削減**: Flash使用プロジェクトで約70%削減
2. **レスポンス向上**: Flash使用で2-3倍高速化
3. **API Key管理**: 1つのKeyで統一管理
4. **保守性向上**: 設定の一元化

---

**生成日時**: 自動生成
"""
        
        return report


def main():
    """メインエントリーポイント"""
    import sys
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Gemini API統一化・最適化ツール'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='変更せずに確認のみ'
    )
    parser.add_argument(
        '--projects-dir',
        type=Path,
        default=Path('gas_projects'),
        help='プロジェクトディレクトリ'
    )
    
    args = parser.parse_args()
    
    if not args.projects_dir.exists():
        print(f"Error: {args.projects_dir} not found")
        sys.exit(1)
    
    print("="*70)
    print("Gemini API統一化・最適化ツール")
    print("="*70)
    print()
    
    optimizer = GeminiAPIOptimizer(args.projects_dir)
    
    print("プロジェクトを分析中...")
    configs = optimizer.analyze_all_projects()
    
    print(f"分析完了: {len(configs)}プロジェクト")
    print()
    
    # サマリー表示
    pro_count = len([c for c in configs if c.recommended_model == 'pro'])
    flash_count = len([c for c in configs if c.recommended_model == 'flash'])
    
    print(f"gemini-1.5-pro推奨: {pro_count}プロジェクト")
    print(f"gemini-2.5-flash推奨: {flash_count}プロジェクト")
    print()
    
    # レポート生成
    report = optimizer.generate_summary_report(configs)
    report_path = Path('GEMINI_OPTIMIZATION_REPORT.md')
    report_path.write_text(report, encoding='utf-8')
    print(f"✓ レポート保存: {report_path}")
    print()
    
    if args.dry_run:
        print("ドライランモード: 変更は行いません")
        print()
        print("実際に適用するには --dry-run なしで実行してください:")
        print("  python optimize_gemini.py")
        return
    
    # 更新実行
    print("プロジェクトを更新中...")
    print()
    
    total_stats = {
        'files_updated': 0,
        'api_keys_replaced': 0,
        'models_changed': 0,
        'errors': []
    }
    
    for i, config in enumerate(configs, 1):
        print(f"[{i}/{len(configs)}] {config.project_name}")
        print(f"  推奨モデル: {config.recommended_model}")
        
        stats = optimizer.update_project(config, dry_run=False)
        
        print(f"  ✓ ファイル更新: {stats['files_updated']}")
        print(f"  ✓ API Key置換: {stats['api_keys_replaced']}")
        print(f"  ✓ モデル変更: {stats['models_changed']}")
        
        if stats['errors']:
            print(f"  ⚠ エラー: {len(stats['errors'])}")
            for error in stats['errors']:
                print(f"    - {error}")
        
        # 統計集計
        total_stats['files_updated'] += stats['files_updated']
        total_stats['api_keys_replaced'] += stats['api_keys_replaced']
        total_stats['models_changed'] += stats['models_changed']
        total_stats['errors'].extend(stats['errors'])
        
        print()
    
    # 最終サマリー
    print("="*70)
    print("✅ 更新完了")
    print("="*70)
    print()
    print(f"更新ファイル数: {total_stats['files_updated']}")
    print(f"API Key置換数: {total_stats['api_keys_replaced']}")
    print(f"モデル変更数: {total_stats['models_changed']}")
    
    if total_stats['errors']:
        print(f"\n⚠ エラー: {len(total_stats['errors'])}件")
        for error in total_stats['errors']:
            print(f"  - {error}")
    
    print()
    print("詳細は GEMINI_OPTIMIZATION_REPORT.md を参照してください")


if __name__ == '__main__':
    main()
