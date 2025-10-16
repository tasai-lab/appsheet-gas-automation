"""
Gemini API to Vertex AI migration analyzer and helper.

Analyzes projects using Gemini API and provides migration guidance.
"""

import re
from pathlib import Path
from typing import List, Dict, Optional
from dataclasses import dataclass, field


@dataclass
class APIUsage:
    """API usage information."""
    project_name: str
    api_type: str  # 'gemini', 'vertex', 'both'
    files: List[Path] = field(default_factory=list)
    gemini_calls: int = 0
    vertex_calls: int = 0
    priority: str = 'low'  # 'high', 'medium', 'low'
    
    
class MigrationAnalyzer:
    """Analyze projects for Gemini to Vertex AI migration."""
    
    # Priority keywords for medical/personal data
    HIGH_PRIORITY_KEYWORDS = [
        '訪問看護', '看護記録', '利用者', '患者', '医療',
        '精神科', '計画書', 'フェースシート', '報告書'
    ]
    
    MEDIUM_PRIORITY_KEYWORDS = [
        '営業', '通話', 'クエリ', 'レポート'
    ]
    
    def __init__(self, projects_dir: Path):
        self.projects_dir = projects_dir
        
    def analyze_all_projects(self) -> List[APIUsage]:
        """Analyze all projects."""
        results = []
        
        for project_dir in self.projects_dir.iterdir():
            if not project_dir.is_dir():
                continue
                
            usage = self._analyze_project(project_dir)
            if usage:
                results.append(usage)
        
        # Sort by priority
        results.sort(key=lambda x: (
            0 if x.priority == 'high' else 1 if x.priority == 'medium' else 2,
            x.project_name
        ))
        
        return results
    
    def _analyze_project(self, project_dir: Path) -> Optional[APIUsage]:
        """Analyze single project."""
        scripts_dir = project_dir / 'scripts'
        if not scripts_dir.exists():
            return None
        
        usage = APIUsage(project_name=project_dir.name, api_type='none')
        
        # Check each script file
        for script_file in scripts_dir.glob('*.gs'):
            try:
                content = script_file.read_text(encoding='utf-8', errors='ignore')
                
                # Check for Gemini API
                gemini_matches = len(re.findall(
                    r'generativelanguage\.googleapis\.com|gemini-pro|gemini-1\.5',
                    content,
                    re.IGNORECASE
                ))
                
                # Check for Vertex AI
                vertex_matches = len(re.findall(
                    r'aiplatform\.googleapis\.com|vertexai|asia-northeast1.*gemini',
                    content,
                    re.IGNORECASE
                ))
                
                if gemini_matches > 0 or vertex_matches > 0:
                    usage.files.append(script_file)
                    usage.gemini_calls += gemini_matches
                    usage.vertex_calls += vertex_matches
                    
            except Exception as e:
                print(f"Error reading {script_file}: {e}")
        
        # Determine API type
        if usage.gemini_calls > 0 and usage.vertex_calls > 0:
            usage.api_type = 'both'
        elif usage.gemini_calls > 0:
            usage.api_type = 'gemini'
        elif usage.vertex_calls > 0:
            usage.api_type = 'vertex'
        else:
            return None  # No AI API usage
        
        # Determine priority
        usage.priority = self._determine_priority(project_dir.name)
        
        return usage
    
    def _determine_priority(self, project_name: str) -> str:
        """Determine migration priority based on project name."""
        # High priority: Medical/personal data
        for keyword in self.HIGH_PRIORITY_KEYWORDS:
            if keyword in project_name:
                return 'high'
        
        # Medium priority: Business critical
        for keyword in self.MEDIUM_PRIORITY_KEYWORDS:
            if keyword in project_name:
                return 'medium'
        
        return 'low'
    
    def generate_migration_report(self, results: List[APIUsage]) -> str:
        """Generate migration report."""
        total = len(results)
        gemini_only = len([r for r in results if r.api_type == 'gemini'])
        vertex_only = len([r for r in results if r.api_type == 'vertex'])
        both = len([r for r in results if r.api_type == 'both'])
        
        high_priority = [r for r in results if r.priority == 'high']
        medium_priority = [r for r in results if r.priority == 'medium']
        low_priority = [r for r in results if r.priority == 'low']
        
        report = f"""
# Gemini API → Vertex AI 移行レポート

## サマリー

- **総プロジェクト数**: {total}
  - Gemini API のみ: {gemini_only}
  - Vertex AI のみ: {vertex_only}
  - 両方使用: {both}

## 移行優先度別

### 🔴 高優先度（医療・個人情報）: {len(high_priority)}プロジェクト

これらのプロジェクトは個人情報・医療データを扱うため、**即座に移行を推奨**します。

"""
        for usage in high_priority:
            report += f"#### {usage.project_name}\n"
            report += f"- 現在のAPI: {usage.api_type}\n"
            report += f"- Gemini呼び出し数: {usage.gemini_calls}\n"
            report += f"- Vertex呼び出し数: {usage.vertex_calls}\n"
            report += f"- 影響ファイル数: {len(usage.files)}\n"
            if usage.api_type == 'gemini':
                report += f"- **アクション**: Vertex AIへの移行が必要\n"
            elif usage.api_type == 'both':
                report += f"- **アクション**: Gemini API呼び出しをVertex AIに統一\n"
            else:
                report += f"- **アクション**: 既にVertex AI使用中（完了）\n"
            report += "\n"
        
        report += f"\n### 🟡 中優先度（業務クリティカル）: {len(medium_priority)}プロジェクト\n\n"
        for usage in medium_priority:
            report += f"- **{usage.project_name}** ({usage.api_type}): "
            report += f"Gemini {usage.gemini_calls}回, Vertex {usage.vertex_calls}回\n"
        
        report += f"\n### 🟢 低優先度（内部ツール）: {len(low_priority)}プロジェクト\n\n"
        for usage in low_priority:
            report += f"- **{usage.project_name}** ({usage.api_type}): "
            report += f"Gemini {usage.gemini_calls}回, Vertex {usage.vertex_calls}回\n"
        
        report += "\n## 推奨移行スケジュール\n\n"
        report += "### フェーズ1（Week 1-2）: 高優先度プロジェクト\n\n"
        for i, usage in enumerate(high_priority[:5], 1):
            if usage.api_type != 'vertex':
                report += f"{i}. {usage.project_name}\n"
        
        report += "\n### フェーズ2（Week 3-4）: 高優先度残り + 中優先度\n\n"
        remaining_high = [u for u in high_priority[5:] if u.api_type != 'vertex']
        for i, usage in enumerate(remaining_high + medium_priority[:3], 1):
            if usage.api_type != 'vertex':
                report += f"{i}. {usage.project_name}\n"
        
        report += "\n### フェーズ3（Week 5-6）: その他全プロジェクト\n\n"
        report += "残りのプロジェクトを順次移行\n"
        
        report += "\n## 移行ファイル詳細\n\n"
        for usage in results:
            if usage.api_type == 'gemini' or usage.api_type == 'both':
                report += f"\n### {usage.project_name}\n\n"
                report += "修正が必要なファイル:\n"
                for file_path in usage.files:
                    report += f"- `{file_path.name}`\n"
        
        report += f"""

## 次のアクション

1. **appsscript.json更新**: 全プロジェクトで以下を追加
   ```json
   {{
     "oauthScopes": [
       "https://www.googleapis.com/auth/cloud-platform"
     ]
   }}
   ```

2. **共通ライブラリ作成**: `vertex_ai_helper.gs`を作成して全プロジェクトで使用

3. **段階的移行**: 優先度順に移行・テスト

4. **監視設定**: Cloud Monitoringでアラート設定

---

**生成日時**: 自動生成
"""
        
        return report


def main():
    """Main entry point."""
    import sys
    
    projects_dir = Path('gas_projects')
    
    if not projects_dir.exists():
        print(f"Error: {projects_dir} not found")
        sys.exit(1)
    
    print("="*70)
    print("Gemini API → Vertex AI 移行分析")
    print("="*70)
    print()
    
    analyzer = MigrationAnalyzer(projects_dir)
    
    print("プロジェクトを分析中...")
    results = analyzer.analyze_all_projects()
    
    print(f"分析完了: {len(results)}プロジェクト")
    print()
    
    # Display summary
    gemini_only = [r for r in results if r.api_type == 'gemini']
    vertex_only = [r for r in results if r.api_type == 'vertex']
    both = [r for r in results if r.api_type == 'both']
    
    print(f"Gemini APIのみ: {len(gemini_only)}")
    print(f"Vertex AIのみ: {len(vertex_only)}")
    print(f"両方使用: {len(both)}")
    print()
    
    # Generate report
    report = analyzer.generate_migration_report(results)
    
    # Save report
    report_path = Path('MIGRATION_ANALYSIS.md')
    report_path.write_text(report, encoding='utf-8')
    
    print(f"✓ レポート保存: {report_path}")
    print()
    print("詳細は MIGRATION_ANALYSIS.md を参照してください")


if __name__ == '__main__':
    main()
