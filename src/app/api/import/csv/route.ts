import { NextRequest, NextResponse } from 'next/server';
import { parseCSV } from '@/lib/parsers';
import { classifyTransactions } from '@/lib/categories/engine';
import { checkSameSourceDuplicate, findCrossSourceDuplicates } from '@/lib/dedup';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: '请上传文件' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = parseCSV(buffer, file.name);

    if (result.transactions.length === 0) {
      return NextResponse.json({
        source: result.source,
        transactions: [],
        crossSourceDuplicates: [],
        errors: result.errors,
        total: 0,
        duplicateCount: 0,
        debug: result.debug,
      });
    }

    const classified = await classifyTransactions(result.transactions);

    const withDupCheck = [];
    for (const t of classified) {
      withDupCheck.push({ ...t, isDuplicate: await checkSameSourceDuplicate(t) });
    }

    const nonDuplicates = withDupCheck.filter(t => !t.isDuplicate);
    const crossDups = await findCrossSourceDuplicates(nonDuplicates);

    return NextResponse.json({
      source: result.source,
      transactions: withDupCheck,
      crossSourceDuplicates: crossDups,
      errors: result.errors,
      total: result.transactions.length,
      duplicateCount: withDupCheck.filter(t => t.isDuplicate).length,
      debug: result.debug,
    });
  } catch (err) {
    return NextResponse.json({
      error: '解析 CSV 失败: ' + (err as Error).message,
    }, { status: 500 });
  }
}
