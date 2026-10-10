import { getDb, scheduleSave } from '../db/database';

export interface ChartWidget {
  id: number;
  name: string;
  chart_type: string;
  metric: string;
  group_by: string;
  period: string;
  custom_from: string | null;
  custom_to: string | null;
  account_filter: string | null;
  tag_filter: string | null;
  pinned: number;
  sort_order: number;
  created_at: string;
  default_key: string | null;
  size: number;
}

function rowToWidget(row: any[]): ChartWidget {
  return {
    id: row[0] as number,
    name: row[1] as string,
    chart_type: row[2] as string,
    metric: row[3] as string,
    group_by: row[4] as string,
    period: row[5] as string,
    custom_from: row[6] as string | null,
    custom_to: row[7] as string | null,
    account_filter: row[8] as string | null,
    tag_filter: row[9] as string | null,
    pinned: row[10] as number,
    sort_order: row[11] as number,
    created_at: row[12] as string,
    default_key: row[13] as string | null ?? null,
    size: row[14] as number ?? 1,
  };
}

export async function getAllWidgets(): Promise<ChartWidget[]> {
  const db = await getDb();
  const result = db.exec(`SELECT * FROM chart_widgets ORDER BY sort_order, id`);
  if (result.length === 0) return [];
  return result[0].values.map(rowToWidget);
}

export async function getPinnedWidgets(): Promise<ChartWidget[]> {
  const db = await getDb();
  const result = db.exec(`SELECT * FROM chart_widgets WHERE pinned = 1 ORDER BY sort_order, id`);
  if (result.length === 0) return [];
  return result[0].values.map(rowToWidget);
}

export async function createWidget(data: Omit<ChartWidget, 'id' | 'created_at' | 'sort_order'> & { sort_order?: number }): Promise<number> {
  const db = await getDb();
  db.run(
    `INSERT INTO chart_widgets (name, chart_type, metric, group_by, period, custom_from, custom_to, account_filter, tag_filter, pinned, sort_order, default_key, size)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.name, data.chart_type, data.metric, data.group_by, data.period, data.custom_from, data.custom_to, data.account_filter, data.tag_filter, data.pinned ?? 0, data.sort_order ?? 0, data.default_key ?? null, data.size ?? 1],
  );
  scheduleSave();
  const result = db.exec('SELECT last_insert_rowid()');
  return result[0].values[0][0] as number;
}

export async function updateWidget(id: number, data: Partial<ChartWidget>): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: any[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (['id', 'created_at'].includes(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }
  values.push(id);
  db.run(`UPDATE chart_widgets SET ${fields.join(', ')} WHERE id = ?`, values);
  scheduleSave();
}

export async function deleteWidget(id: number): Promise<void> {
  const db = await getDb();
  db.run(`DELETE FROM chart_widgets WHERE id = ?`, [id]);
  scheduleSave();
}

export async function reorderWidgets(ids: number[]): Promise<void> {
  const db = await getDb();
  for (let i = 0; i < ids.length; i++) {
    db.run(`UPDATE chart_widgets SET sort_order = ? WHERE id = ?`, [i, ids[i]]);
  }
  scheduleSave();
}
