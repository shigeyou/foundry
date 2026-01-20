import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            勝ち筋ファインダー
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            現場の力をAIでアンプする戦略発見ツール
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>探索を始める</CardTitle>
              <CardDescription>
                問いを入力して、AIが勝ち筋を提案します
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/explore">
                <Button className="w-full" size="lg">
                  探索を始める
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>コア情報を登録</CardTitle>
              <CardDescription>
                サービス・資産・強みを登録して精度を上げます
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/core">
                <Button className="w-full" variant="outline" size="lg">
                  コア情報を登録
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <Link href="/history" className="text-slate-600 hover:text-slate-900">
            過去の探索履歴を見る →
          </Link>
        </div>
      </div>
    </main>
  );
}
