-- ============================================
-- Sprint 2: Form Templates based on actual Excel templates
-- All 21 Excel templates analyzed and converted
-- ============================================

-- ========== 1. Add new document types for unmatched templates ==========
INSERT INTO document_types (code, name, category, description, icon, sort_order) VALUES
  ('T15', '交通費精算', '経費・精算', '交通費の精算申請', 'train', 18),
  ('T16', '物品購入依頼', '社内申請', '物品の購入依頼', 'package', 19),
  ('T17', '稟議書', '社内申請', '社内決裁のための稟議', 'stamp', 20),
  ('T18', '経費精算', '経費・精算', '経費の精算申請', 'wallet', 21),
  ('T11e', '出荷証明書（大丸大阪）', '出荷証明書', '大丸松坂屋百貨店大阪店向け出荷証明', 'truck', 22),
  ('T19', '出荷証明書（汎用）', '出荷証明書', '汎用の出荷証明書', 'truck', 23),
  ('T20', '商品納入証明書（汎用）', '出荷証明書', '汎用の商品納入証明書', 'clipboard-check', 24);

-- ========== 2. Update document type names to match actual templates ==========
UPDATE document_types SET name = 'デザイン企画依頼書' WHERE code = 'T04';
UPDATE document_types SET name = '出荷証明書（そごう西武）' WHERE code = 'T11b';
UPDATE document_types SET name = '出荷証明書（高島屋）' WHERE code = 'T11c';
UPDATE document_types SET name = '出荷証明書（大丸松坂屋）' WHERE code = 'T11d';

-- ========== 3. Update existing T01 form template to match actual Excel ==========
UPDATE form_templates SET schema = '{
  "version": 1,
  "fields": [
    {"id": "customer_name", "type": "text", "label": "顧客名", "required": true},
    {"id": "visit_datetime", "type": "text", "label": "日時", "required": true, "placeholder": "例: 2026/03/01 10:00〜16:00"},
    {"id": "location", "type": "text", "label": "採寸場所", "required": true},
    {"id": "content", "type": "textarea", "label": "内容", "required": true, "rows": 4},
    {"id": "total_cost", "type": "currency", "label": "トータル費用", "required": false},
    {"id": "cost_share", "type": "text", "label": "費用負担", "required": false, "placeholder": "例: 当社負担 / 折半 / 顧客負担"},
    {"id": "cost_share_detail", "type": "textarea", "label": "分担詳細", "required": false, "rows": 2},
    {"id": "sales_amount", "type": "currency", "label": "案件売上", "required": false},
    {"id": "remarks", "type": "textarea", "label": "備考", "required": false, "rows": 3}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "採寸情報", "fields": ["customer_name", "visit_datetime", "location"]},
      {"title": "内容", "fields": ["content"]},
      {"title": "費用", "fields": ["total_cost", "cost_share", "cost_share_detail", "sales_amount"]},
      {"title": "備考", "fields": ["remarks"]}
    ]
  }
}'::jsonb
WHERE document_type_id = (SELECT id FROM document_types WHERE code = 'T01')
  AND is_current = true;

-- ========== 4. Update existing T05 form template to match actual Excel ==========
UPDATE form_templates SET schema = '{
  "version": 1,
  "fields": [
    {"id": "occurrence_company", "type": "text", "label": "発生会社", "required": true},
    {"id": "department_name", "type": "text", "label": "部署名", "required": true},
    {"id": "incident_type", "type": "text", "label": "件名〈種別〉", "required": true},
    {"id": "summary", "type": "textarea", "label": "概要", "required": true, "rows": 4},
    {"id": "manifest_event", "type": "textarea", "label": "顕在化事象", "required": false, "rows": 3},
    {"id": "factor", "type": "textarea", "label": "要因", "required": false, "rows": 3},
    {"id": "discovery_date", "type": "date", "label": "判明日", "required": true},
    {"id": "occurrence_period", "type": "text", "label": "発生日・期間", "required": true},
    {"id": "discovery_details", "type": "textarea", "label": "判明経緯", "required": true, "rows": 4},
    {"id": "cause", "type": "textarea", "label": "原因", "required": true, "rows": 4},
    {"id": "current_status", "type": "textarea", "label": "現状", "required": false, "rows": 3},
    {"id": "interim_measures", "type": "textarea", "label": "経過措置等", "required": false, "rows": 3},
    {"id": "damage_amount", "type": "currency", "label": "損害額", "required": false},
    {"id": "future_impact", "type": "textarea", "label": "今後の影響等", "required": false, "rows": 3},
    {"id": "prevention_measures", "type": "textarea", "label": "再発防止策", "required": true, "rows": 4},
    {"id": "remarks", "type": "textarea", "label": "備考", "required": false, "rows": 3}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "発生元情報", "fields": ["occurrence_company", "department_name", "incident_type"]},
      {"title": "事象概要", "fields": ["summary", "manifest_event", "factor"]},
      {"title": "経緯", "fields": ["discovery_date", "occurrence_period", "discovery_details"]},
      {"title": "原因・現状", "fields": ["cause", "current_status", "interim_measures"]},
      {"title": "影響・対策", "fields": ["damage_amount", "future_impact", "prevention_measures"]},
      {"title": "備考", "fields": ["remarks"]}
    ]
  }
}'::jsonb
WHERE document_type_id = (SELECT id FROM document_types WHERE code = 'T05')
  AND is_current = true;

-- ========== 5. New form templates ==========

-- T02: 海外出張事前申請書
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "period", "type": "text", "label": "期間", "required": true, "placeholder": "例: 2026/3/10〜3/15"},
    {"id": "destination", "type": "text", "label": "目的地", "required": true},
    {"id": "user_name", "type": "text", "label": "ユーザー名", "required": false},
    {"id": "purpose", "type": "textarea", "label": "目的及び案件", "required": true, "rows": 5},
    {"id": "property_details", "type": "table", "label": "物件明細", "columns": [
      {"id": "user", "type": "text", "label": "ユーザー", "width": "12%"},
      {"id": "item", "type": "text", "label": "アイテム", "width": "14%"},
      {"id": "quantity", "type": "number", "label": "数量", "width": "8%"},
      {"id": "unit_price", "type": "currency", "label": "単価", "width": "12%"},
      {"id": "profit_per", "type": "currency", "label": "利益", "width": "12%"},
      {"id": "sales_total", "type": "formula", "label": "売上計", "formula": "quantity * unit_price", "width": "12%"},
      {"id": "profit_total", "type": "formula", "label": "利益計", "formula": "quantity * profit_per", "width": "12%"},
      {"id": "delivery", "type": "text", "label": "納期", "width": "12%"}
    ], "minRows": 1, "maxRows": 10, "allowExcelPaste": true},
    {"id": "procurement_route", "type": "text", "label": "仕入経路", "required": false},
    {"id": "airfare", "type": "currency", "label": "航空チケット", "required": false},
    {"id": "hotel", "type": "currency", "label": "ホテル代", "required": false},
    {"id": "other_transport", "type": "currency", "label": "その他交通費", "required": false},
    {"id": "trip_cost_total", "type": "formula", "label": "出張費合計", "formula": "airfare + hotel + other_transport"},
    {"id": "client_accompany", "type": "select", "label": "得意先同行の有無", "required": false, "options": [
      {"value": "yes", "label": "あり"},
      {"value": "no", "label": "なし"}
    ]},
    {"id": "client_name_count", "type": "text", "label": "得意先名及び人数", "required": false},
    {"id": "client_expense_share", "type": "text", "label": "得意先経費負担", "required": false},
    {"id": "client_expense_amount", "type": "currency", "label": "金額", "required": false}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "出張基本情報", "fields": ["period", "destination", "user_name"]},
      {"title": "目的・案件", "fields": ["purpose"]},
      {"title": "物件明細", "fields": ["property_details"]},
      {"title": "仕入経路", "fields": ["procurement_route"]},
      {"title": "出張費概算", "fields": ["airfare", "hotel", "other_transport", "trip_cost_total"]},
      {"title": "得意先情報", "fields": ["client_accompany", "client_name_count", "client_expense_share", "client_expense_amount"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T02';

-- T03: 海外出張報告書
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "trip_destination", "type": "text", "label": "出張地", "required": true},
    {"id": "trip_date", "type": "text", "label": "出張日", "required": true, "placeholder": "例: 2026/3/10〜3/15"},
    {"id": "purpose", "type": "textarea", "label": "目的", "required": true, "rows": 5},
    {"id": "property_details", "type": "table", "label": "物件明細", "columns": [
      {"id": "property_name", "type": "text", "label": "物件名", "width": "20%"},
      {"id": "user", "type": "text", "label": "ユーザー", "width": "20%"},
      {"id": "item", "type": "text", "label": "アイテム", "width": "20%"},
      {"id": "sales_10k", "type": "number", "label": "売上(万)", "width": "15%"},
      {"id": "profit_10k", "type": "number", "label": "利益(万)", "width": "15%"}
    ], "minRows": 1, "maxRows": 8, "allowExcelPaste": true},
    {"id": "schedule_details", "type": "table", "label": "日程詳細", "columns": [
      {"id": "date", "type": "text", "label": "日付", "width": "20%"},
      {"id": "flight_time", "type": "text", "label": "便名・時刻", "width": "25%"},
      {"id": "content", "type": "text", "label": "内容", "width": "55%"}
    ], "minRows": 1, "maxRows": 15, "allowExcelPaste": true}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "出張概要", "fields": ["trip_destination", "trip_date"]},
      {"title": "目的", "fields": ["purpose"]},
      {"title": "物件明細", "fields": ["property_details"]},
      {"title": "日程詳細", "fields": ["schedule_details"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T03';

-- T04: デザイン企画依頼書
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "doc_no", "type": "text", "label": "NO", "required": false},
    {"id": "user_name", "type": "text", "label": "ユーザー名", "required": true},
    {"id": "industry", "type": "text", "label": "業種", "required": false},
    {"id": "target_count_male", "type": "number", "label": "対象人数（男）", "required": false},
    {"id": "target_count_female", "type": "number", "label": "対象人数（女）", "required": false},
    {"id": "age_range", "type": "text", "label": "年齢層", "required": false},
    {"id": "contact_person", "type": "text", "label": "窓口", "required": false},
    {"id": "current_vendor", "type": "text", "label": "現行業者", "required": false},
    {"id": "competitor_count", "type": "number", "label": "競合先（社数）", "required": false},
    {"id": "competitor_names", "type": "text", "label": "競合先社名", "required": false},
    {"id": "desired_cost", "type": "text", "label": "希望コスト", "required": false},
    {"id": "item_details", "type": "table", "label": "アイテム明細", "columns": [
      {"id": "item_name", "type": "text", "label": "アイテム", "width": "18%"},
      {"id": "quantity", "type": "number", "label": "数量", "width": "10%"},
      {"id": "selling_price", "type": "currency", "label": "売価", "width": "12%"},
      {"id": "sales", "type": "formula", "label": "売上", "formula": "quantity * selling_price", "width": "14%"},
      {"id": "cost_per_unit", "type": "currency", "label": "コスト/枚", "width": "12%"},
      {"id": "profit", "type": "formula", "label": "利益額", "formula": "sales - quantity * cost_per_unit", "width": "14%"},
      {"id": "profit_rate", "type": "formula", "label": "利益率", "formula": "profit / sales * 100", "width": "10%"}
    ], "minRows": 1, "maxRows": 10, "allowExcelPaste": true},
    {"id": "competition_method", "type": "textarea", "label": "コンペ方法・決定方法", "required": false, "rows": 3},
    {"id": "priority_design", "type": "number", "label": "優先順位：デザイン", "required": false},
    {"id": "priority_function", "type": "number", "label": "優先順位：機能", "required": false},
    {"id": "priority_cost", "type": "number", "label": "優先順位：コスト", "required": false},
    {"id": "priority_operation", "type": "number", "label": "優先順位：運用", "required": false},
    {"id": "priority_other", "type": "number", "label": "優先順位：その他", "required": false},
    {"id": "schedule", "type": "table", "label": "スケジュール", "columns": [
      {"id": "phase", "type": "text", "label": "項目", "width": "25%"},
      {"id": "date", "type": "text", "label": "日付", "width": "20%"},
      {"id": "content", "type": "text", "label": "内容", "width": "35%"},
      {"id": "cost", "type": "currency", "label": "費用", "width": "20%"}
    ], "minRows": 5, "maxRows": 10, "allowExcelPaste": true},
    {"id": "requirements", "type": "textarea", "label": "必須条件", "required": false, "rows": 4}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "基本情報", "fields": ["doc_no", "user_name", "industry"]},
      {"title": "対象情報", "fields": ["target_count_male", "target_count_female", "age_range"]},
      {"title": "取引情報", "fields": ["contact_person", "current_vendor", "competitor_count", "competitor_names"]},
      {"title": "アイテム明細", "fields": ["desired_cost", "item_details"]},
      {"title": "コンペ・優先順位", "fields": ["competition_method", "priority_design", "priority_function", "priority_cost", "priority_operation", "priority_other"]},
      {"title": "スケジュール", "fields": ["schedule"]},
      {"title": "必須条件", "fields": ["requirements"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T04';

-- T06: クレーム報告書（簡易版）
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "author", "type": "text", "label": "記入者", "required": true},
    {"id": "occurrence_date", "type": "date", "label": "発生日(判明日)", "required": true},
    {"id": "user_name", "type": "text", "label": "ユーザー名", "required": true},
    {"id": "product_name", "type": "text", "label": "商品名", "required": true},
    {"id": "production_quantity", "type": "number", "label": "生産数量", "required": false},
    {"id": "supplier", "type": "text", "label": "発注先", "required": false},
    {"id": "claim_type", "type": "text", "label": "クレームの種類", "required": true},
    {"id": "claim_summary", "type": "textarea", "label": "クレーム概要", "required": true, "rows": 4},
    {"id": "discovery_details", "type": "textarea", "label": "判明経緯", "required": false, "rows": 4},
    {"id": "cause", "type": "textarea", "label": "原因", "required": true, "rows": 4},
    {"id": "action_method", "type": "text", "label": "対処方法", "required": false},
    {"id": "action_detail", "type": "textarea", "label": "対処詳細", "required": false, "rows": 4},
    {"id": "current_status", "type": "textarea", "label": "現状", "required": false, "rows": 3},
    {"id": "damage_total", "type": "currency", "label": "損害額（総額）", "required": false},
    {"id": "cost_bearer", "type": "text", "label": "費用負担先", "required": false},
    {"id": "progress_log", "type": "table", "label": "経過", "columns": [
      {"id": "date", "type": "text", "label": "日付", "width": "15%"},
      {"id": "customer_rep", "type": "text", "label": "顧客側担当", "width": "20%"},
      {"id": "our_rep", "type": "text", "label": "当社担当", "width": "20%"},
      {"id": "negotiation", "type": "text", "label": "折衝内容", "width": "45%"}
    ], "minRows": 1, "maxRows": 15, "allowExcelPaste": true}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "クレーム概要", "fields": ["author", "occurrence_date", "user_name", "product_name", "production_quantity", "supplier"]},
      {"title": "クレーム内容", "fields": ["claim_type", "claim_summary", "discovery_details"]},
      {"title": "原因・対応", "fields": ["cause", "action_method", "action_detail", "current_status"]},
      {"title": "損害・費用", "fields": ["damage_total", "cost_bearer"]},
      {"title": "経過", "fields": ["progress_log"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T06';

-- T07: 仕様修正依頼書
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "user_name", "type": "text", "label": "ユーザー名", "required": true},
    {"id": "item_name", "type": "text", "label": "アイテム名", "required": true},
    {"id": "product_code", "type": "text", "label": "製品品番", "required": true},
    {"id": "pattern_maker", "type": "text", "label": "パタンナー", "required": false},
    {"id": "change_reason", "type": "textarea", "label": "変更理由", "required": true, "rows": 4},
    {"id": "change_timing", "type": "text", "label": "変更時期", "required": false},
    {"id": "spec_sheet_deadline", "type": "date", "label": "仕様書修正期限", "required": false},
    {"id": "pattern_deadline", "type": "date", "label": "パターン修正期限", "required": false},
    {"id": "change_details", "type": "table", "label": "変更依頼内容", "columns": [
      {"id": "part", "type": "text", "label": "部位", "width": "20%"},
      {"id": "before", "type": "text", "label": "変更前内容", "width": "40%"},
      {"id": "after", "type": "text", "label": "変更後内容", "width": "40%"}
    ], "minRows": 1, "maxRows": 15, "allowExcelPaste": true}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "基本情報", "fields": ["user_name", "item_name", "product_code", "pattern_maker"]},
      {"title": "変更理由・時期", "fields": ["change_reason", "change_timing", "spec_sheet_deadline", "pattern_deadline"]},
      {"title": "変更依頼内容", "fields": ["change_details"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T07';

-- T08: 企画外注注文書（依頼書）
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "contractor", "type": "text", "label": "受託者", "required": true},
    {"id": "request_number", "type": "text", "label": "依頼番号", "required": false},
    {"id": "request_date", "type": "date", "label": "依頼日", "required": true, "defaultValue": "today"},
    {"id": "request_content", "type": "textarea", "label": "依頼内容", "required": true, "rows": 4},
    {"id": "fabric_delivery", "type": "text", "label": "職出し", "required": false},
    {"id": "delivery_date", "type": "date", "label": "納期", "required": true},
    {"id": "line_items", "type": "table", "label": "明細", "columns": [
      {"id": "item_name", "type": "text", "label": "品名", "width": "25%"},
      {"id": "quantity", "type": "number", "label": "数量", "width": "12%"},
      {"id": "unit_price", "type": "currency", "label": "単価", "width": "15%"},
      {"id": "amount", "type": "formula", "label": "金額", "formula": "quantity * unit_price", "width": "18%"},
      {"id": "description", "type": "text", "label": "内容", "width": "30%"}
    ], "minRows": 1, "maxRows": 15, "allowExcelPaste": true},
    {"id": "total_amount", "type": "formula", "label": "合計金額（税別）", "formula": "SUM(line_items.amount)"}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "依頼情報", "fields": ["contractor", "request_number", "request_date"]},
      {"title": "依頼内容", "fields": ["request_content", "fabric_delivery", "delivery_date"]},
      {"title": "明細", "fields": ["line_items", "total_amount"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T08';

-- T09: グレーディングパターン作製依頼書
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "vendor", "type": "text", "label": "発注先", "required": true},
    {"id": "order_content", "type": "text", "label": "発注内容", "required": false, "defaultValue": "下記明細の通り"},
    {"id": "delivery_date", "type": "date", "label": "納期", "required": true},
    {"id": "delivery_destination", "type": "text", "label": "納品先", "required": true},
    {"id": "unit_price", "type": "currency", "label": "単価", "required": false},
    {"id": "total_amount", "type": "currency", "label": "合計金額", "required": false},
    {"id": "payment_method", "type": "text", "label": "支払い方法", "required": false, "defaultValue": "取り決め通り"},
    {"id": "user_name", "type": "text", "label": "ユーザー", "required": false},
    {"id": "production_manager", "type": "text", "label": "生産担当者", "required": false},
    {"id": "pattern_maker", "type": "text", "label": "パタンナー", "required": false},
    {"id": "pattern_details", "type": "table", "label": "パターン明細", "columns": [
      {"id": "product_code", "type": "text", "label": "製品品番", "width": "25%"},
      {"id": "pattern_no", "type": "text", "label": "パターンNo.", "width": "20%"},
      {"id": "item_name", "type": "text", "label": "アイテム名", "width": "30%"},
      {"id": "parts", "type": "text", "label": "パーツ", "width": "25%"}
    ], "minRows": 1, "maxRows": 10, "allowExcelPaste": true},
    {"id": "size_details", "type": "textarea", "label": "サイズ明細", "required": false, "rows": 4},
    {"id": "output", "type": "text", "label": "出力", "required": false},
    {"id": "destination_factory", "type": "text", "label": "送信先工場", "required": false}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "発注情報", "fields": ["vendor", "order_content", "delivery_date", "delivery_destination"]},
      {"title": "金額", "fields": ["unit_price", "total_amount", "payment_method"]},
      {"title": "担当者", "fields": ["user_name", "production_manager", "pattern_maker"]},
      {"title": "パターン明細", "fields": ["pattern_details"]},
      {"title": "サイズ・出力", "fields": ["size_details", "output", "destination_factory"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T09';

-- T10: 生地手配予定表
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "project_name", "type": "text", "label": "物件名", "required": true},
    {"id": "request_date", "type": "date", "label": "依頼日", "required": true, "defaultValue": "today"},
    {"id": "fabric_schedule", "type": "table", "label": "手配明細", "columns": [
      {"id": "product_code", "type": "text", "label": "製品品番", "width": "8%"},
      {"id": "item", "type": "text", "label": "アイテム", "width": "8%"},
      {"id": "current_stock", "type": "number", "label": "現在庫", "width": "5%"},
      {"id": "processing_qty", "type": "number", "label": "加工数", "width": "5%"},
      {"id": "delivery", "type": "text", "label": "納期", "width": "6%"},
      {"id": "mar", "type": "number", "label": "3月", "width": "4%"},
      {"id": "apr", "type": "number", "label": "4月", "width": "4%"},
      {"id": "jun_onwards", "type": "number", "label": "6月〜", "width": "4%"},
      {"id": "fabric_maker", "type": "text", "label": "生地メーカー", "width": "8%"},
      {"id": "trading_co", "type": "text", "label": "商社", "width": "6%"},
      {"id": "fabric_code", "type": "text", "label": "生地品番", "width": "7%"},
      {"id": "color_no", "type": "text", "label": "色番", "width": "5%"},
      {"id": "detail", "type": "text", "label": "明細", "width": "6%"},
      {"id": "factory", "type": "text", "label": "工場", "width": "5%"},
      {"id": "yield_rate", "type": "number", "label": "要尺", "width": "4%"},
      {"id": "required_qty", "type": "number", "label": "必要数", "width": "5%"},
      {"id": "factory_stock", "type": "number", "label": "工場在庫", "width": "5%"},
      {"id": "warehouse_stock", "type": "number", "label": "倉庫在庫", "width": "5%"},
      {"id": "order_qty", "type": "number", "label": "発注数量", "width": "5%"},
      {"id": "unit_price", "type": "currency", "label": "単価", "width": "5%"}
    ], "minRows": 1, "maxRows": 20, "allowExcelPaste": true},
    {"id": "remarks", "type": "textarea", "label": "備考", "required": false, "rows": 3},
    {"id": "sales_amount", "type": "currency", "label": "販売額", "required": false},
    {"id": "payment_due_date", "type": "date", "label": "入金予定日", "required": false}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "基本情報", "fields": ["project_name", "request_date"]},
      {"title": "手配明細", "fields": ["fabric_schedule"]},
      {"title": "備考・金額", "fields": ["remarks", "sales_amount", "payment_due_date"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T10';

-- T11a: 商品納入証明書（三越伊勢丹）
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "delivery_to", "type": "text", "label": "お届け先", "required": true},
    {"id": "delivery_date", "type": "date", "label": "納入日", "required": true},
    {"id": "product_items", "type": "table", "label": "商品明細", "columns": [
      {"id": "product_name", "type": "text", "label": "商品名", "width": "50%"},
      {"id": "quantity", "type": "number", "label": "数量", "width": "15%"},
      {"id": "remarks", "type": "text", "label": "摘要", "width": "35%"}
    ], "minRows": 1, "maxRows": 20, "allowExcelPaste": true}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "納入情報", "fields": ["delivery_to", "delivery_date"]},
      {"title": "商品明細", "fields": ["product_items"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T11a';

-- T11b: 出荷証明書（そごう西武）
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "department", "type": "text", "label": "部署", "required": false},
    {"id": "contact_person", "type": "text", "label": "担当者様", "required": false},
    {"id": "issue_date", "type": "date", "label": "日付", "required": true, "defaultValue": "today"},
    {"id": "customer_name", "type": "text", "label": "顧客名", "required": true},
    {"id": "project_name", "type": "text", "label": "案件名", "required": true},
    {"id": "shipping_destination", "type": "text", "label": "出荷先", "required": true},
    {"id": "shipping_date", "type": "date", "label": "出荷日", "required": true},
    {"id": "proposal_no", "type": "text", "label": "納品提案書NO", "required": false},
    {"id": "shipping_items", "type": "table", "label": "出荷商品明細", "columns": [
      {"id": "product_name", "type": "text", "label": "品名", "width": "45%"},
      {"id": "quantity", "type": "number", "label": "数量", "width": "15%"},
      {"id": "remarks", "type": "text", "label": "備考", "width": "40%"}
    ], "minRows": 1, "maxRows": 15, "allowExcelPaste": true},
    {"id": "shipment_count", "type": "number", "label": "発送件数", "required": false}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "宛先情報", "fields": ["department", "contact_person", "issue_date"]},
      {"title": "出荷情報", "fields": ["customer_name", "project_name", "shipping_destination", "shipping_date", "proposal_no"]},
      {"title": "出荷商品明細", "fields": ["shipping_items", "shipment_count"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T11b';

-- T11c: 出荷証明書（高島屋） - same structure as T11b
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "department", "type": "text", "label": "部署", "required": false},
    {"id": "contact_person", "type": "text", "label": "担当者様", "required": false},
    {"id": "issue_date", "type": "date", "label": "日付", "required": true, "defaultValue": "today"},
    {"id": "customer_name", "type": "text", "label": "顧客名", "required": true},
    {"id": "project_name", "type": "text", "label": "案件名", "required": true},
    {"id": "shipping_destination", "type": "text", "label": "出荷先", "required": true},
    {"id": "shipping_date", "type": "date", "label": "出荷日", "required": true},
    {"id": "proposal_no", "type": "text", "label": "納品提案書NO", "required": false},
    {"id": "shipping_items", "type": "table", "label": "出荷商品明細", "columns": [
      {"id": "product_name", "type": "text", "label": "品名", "width": "45%"},
      {"id": "quantity", "type": "number", "label": "数量", "width": "15%"},
      {"id": "remarks", "type": "text", "label": "備考", "width": "40%"}
    ], "minRows": 1, "maxRows": 15, "allowExcelPaste": true},
    {"id": "shipment_count", "type": "number", "label": "発送件数", "required": false}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "宛先情報", "fields": ["department", "contact_person", "issue_date"]},
      {"title": "出荷情報", "fields": ["customer_name", "project_name", "shipping_destination", "shipping_date", "proposal_no"]},
      {"title": "出荷商品明細", "fields": ["shipping_items", "shipment_count"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T11c';

-- T11d: 出荷証明書（大丸松坂屋） - same structure as T11b
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "department", "type": "text", "label": "部署", "required": false},
    {"id": "contact_person", "type": "text", "label": "担当者様", "required": false},
    {"id": "issue_date", "type": "date", "label": "日付", "required": true, "defaultValue": "today"},
    {"id": "customer_name", "type": "text", "label": "顧客名", "required": true},
    {"id": "project_name", "type": "text", "label": "案件名", "required": true},
    {"id": "shipping_destination", "type": "text", "label": "出荷先", "required": true},
    {"id": "shipping_date", "type": "date", "label": "出荷日", "required": true},
    {"id": "proposal_no", "type": "text", "label": "納品提案書NO", "required": false},
    {"id": "shipping_items", "type": "table", "label": "出荷商品明細", "columns": [
      {"id": "product_name", "type": "text", "label": "品名", "width": "45%"},
      {"id": "quantity", "type": "number", "label": "数量", "width": "15%"},
      {"id": "remarks", "type": "text", "label": "備考", "width": "40%"}
    ], "minRows": 1, "maxRows": 15, "allowExcelPaste": true},
    {"id": "shipment_count", "type": "number", "label": "発送件数", "required": false}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "宛先情報", "fields": ["department", "contact_person", "issue_date"]},
      {"title": "出荷情報", "fields": ["customer_name", "project_name", "shipping_destination", "shipping_date", "proposal_no"]},
      {"title": "出荷商品明細", "fields": ["shipping_items", "shipment_count"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T11d';

-- T11e: 出荷証明書（大丸大阪） - same structure as T11b
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "department", "type": "text", "label": "部署", "required": false},
    {"id": "contact_person", "type": "text", "label": "担当者様", "required": false},
    {"id": "issue_date", "type": "date", "label": "日付", "required": true, "defaultValue": "today"},
    {"id": "customer_name", "type": "text", "label": "顧客名", "required": true},
    {"id": "project_name", "type": "text", "label": "案件名", "required": true},
    {"id": "shipping_destination", "type": "text", "label": "出荷先", "required": true},
    {"id": "shipping_date", "type": "date", "label": "出荷日", "required": true},
    {"id": "proposal_no", "type": "text", "label": "納品提案書NO", "required": false},
    {"id": "shipping_items", "type": "table", "label": "出荷商品明細", "columns": [
      {"id": "product_name", "type": "text", "label": "品名", "width": "45%"},
      {"id": "quantity", "type": "number", "label": "数量", "width": "15%"},
      {"id": "remarks", "type": "text", "label": "備考", "width": "40%"}
    ], "minRows": 1, "maxRows": 15, "allowExcelPaste": true},
    {"id": "shipment_count", "type": "number", "label": "発送件数", "required": false}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "宛先情報", "fields": ["department", "contact_person", "issue_date"]},
      {"title": "出荷情報", "fields": ["customer_name", "project_name", "shipping_destination", "shipping_date", "proposal_no"]},
      {"title": "出荷商品明細", "fields": ["shipping_items", "shipment_count"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T11e';

-- T12: 商品納入証明書（JR西日本）- based on generic 商品納入証明書
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "delivery_to", "type": "text", "label": "お届け先", "required": true},
    {"id": "company_name", "type": "text", "label": "社名", "required": false},
    {"id": "recipient", "type": "text", "label": "宛先（様）", "required": false},
    {"id": "responsible_person", "type": "text", "label": "責任者（所属・氏名）", "required": false},
    {"id": "delivery_date", "type": "date", "label": "納入日", "required": true},
    {"id": "product_items", "type": "table", "label": "商品明細", "columns": [
      {"id": "product_name", "type": "text", "label": "商品名", "width": "50%"},
      {"id": "quantity", "type": "number", "label": "数量", "width": "15%"},
      {"id": "remarks", "type": "text", "label": "摘要", "width": "35%"}
    ], "minRows": 1, "maxRows": 20, "allowExcelPaste": true}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "納入先情報", "fields": ["delivery_to", "company_name", "recipient", "responsible_person"]},
      {"title": "納入情報", "fields": ["delivery_date"]},
      {"title": "商品明細", "fields": ["product_items"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T12';

-- T13: 請求書
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "issue_date", "type": "date", "label": "発行日", "required": true, "defaultValue": "today"},
    {"id": "invoice_number", "type": "text", "label": "請求番号", "required": false},
    {"id": "registration_number", "type": "text", "label": "登録番号", "required": false, "defaultValue": "T2010001034878"},
    {"id": "client_name", "type": "text", "label": "取引先", "required": true},
    {"id": "bank_info", "type": "text", "label": "振込先", "required": false, "defaultValue": "三菱UFJ銀行 大伝馬町支店"},
    {"id": "payment_due_date", "type": "date", "label": "お支払期日", "required": true},
    {"id": "payment_method", "type": "text", "label": "お支払方法", "required": false},
    {"id": "line_items", "type": "table", "label": "明細", "columns": [
      {"id": "date", "type": "text", "label": "日付", "width": "12%"},
      {"id": "content", "type": "text", "label": "内容", "width": "28%"},
      {"id": "tax_category", "type": "text", "label": "税率区分", "width": "10%"},
      {"id": "quantity", "type": "number", "label": "数量", "width": "8%"},
      {"id": "unit_price", "type": "currency", "label": "単価(税抜)", "width": "14%"},
      {"id": "tax_rate", "type": "text", "label": "税率", "width": "8%"},
      {"id": "amount", "type": "formula", "label": "金額(税抜)", "formula": "quantity * unit_price", "width": "14%"}
    ], "minRows": 1, "maxRows": 15, "allowExcelPaste": true},
    {"id": "subtotal", "type": "formula", "label": "小計（税抜）", "formula": "SUM(line_items.amount)"},
    {"id": "tax_10_amount", "type": "currency", "label": "消費税（10%対象）", "required": false},
    {"id": "tax_8_amount", "type": "currency", "label": "消費税（8%対象）", "required": false},
    {"id": "total_with_tax", "type": "formula", "label": "ご請求金額（税込）", "formula": "subtotal + tax_10_amount + tax_8_amount"}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "請求書情報", "fields": ["issue_date", "invoice_number", "registration_number", "client_name"]},
      {"title": "お支払情報", "fields": ["bank_info", "payment_due_date", "payment_method"]},
      {"title": "明細", "fields": ["line_items", "subtotal"]},
      {"title": "消費税・合計", "fields": ["tax_10_amount", "tax_8_amount", "total_with_tax"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T13';

-- T14: 見積書（Excelテンプレートなし - 請求書ベース）
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "quote_date", "type": "date", "label": "見積日", "required": true, "defaultValue": "today"},
    {"id": "quote_number", "type": "text", "label": "見積番号", "required": false},
    {"id": "valid_until", "type": "date", "label": "有効期限", "required": true},
    {"id": "client_name", "type": "text", "label": "宛名", "required": true},
    {"id": "line_items", "type": "table", "label": "見積明細", "columns": [
      {"id": "content", "type": "text", "label": "品名・内容", "width": "35%"},
      {"id": "quantity", "type": "number", "label": "数量", "width": "10%"},
      {"id": "unit", "type": "text", "label": "単位", "width": "10%"},
      {"id": "unit_price", "type": "currency", "label": "単価", "width": "15%"},
      {"id": "amount", "type": "formula", "label": "金額", "formula": "quantity * unit_price", "width": "15%"}
    ], "minRows": 1, "maxRows": 20, "allowExcelPaste": true},
    {"id": "subtotal", "type": "formula", "label": "小計", "formula": "SUM(line_items.amount)"},
    {"id": "tax_amount", "type": "currency", "label": "消費税", "required": false},
    {"id": "total", "type": "formula", "label": "合計", "formula": "subtotal + tax_amount"},
    {"id": "delivery_terms", "type": "text", "label": "納期", "required": false},
    {"id": "payment_terms", "type": "text", "label": "支払条件", "required": false},
    {"id": "remarks", "type": "textarea", "label": "備考", "required": false, "rows": 3}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "見積情報", "fields": ["quote_date", "quote_number", "valid_until", "client_name"]},
      {"title": "見積明細", "fields": ["line_items", "subtotal", "tax_amount", "total"]},
      {"title": "条件・備考", "fields": ["delivery_terms", "payment_terms", "remarks"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T14';

-- T15: 交通費精算
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "expenses", "type": "table", "label": "交通費明細", "columns": [
      {"id": "date", "type": "text", "label": "日付", "width": "15%"},
      {"id": "from", "type": "text", "label": "出発地", "width": "20%"},
      {"id": "to", "type": "text", "label": "到着地", "width": "20%"},
      {"id": "transport", "type": "text", "label": "交通手段", "width": "15%"},
      {"id": "amount", "type": "currency", "label": "金額（円）", "width": "15%"}
    ], "minRows": 1, "maxRows": 10, "allowExcelPaste": true},
    {"id": "total_amount", "type": "formula", "label": "合計金額", "formula": "SUM(expenses.amount)"}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "交通費明細", "fields": ["expenses", "total_amount"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T15';

-- T16: 物品購入依頼
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "items", "type": "table", "label": "購入明細", "columns": [
      {"id": "item_name", "type": "text", "label": "品名", "width": "35%"},
      {"id": "quantity", "type": "number", "label": "数量", "width": "12%"},
      {"id": "unit_price", "type": "currency", "label": "単価（円）", "width": "18%"},
      {"id": "amount", "type": "formula", "label": "金額（円）", "formula": "quantity * unit_price", "width": "18%"}
    ], "minRows": 1, "maxRows": 5, "allowExcelPaste": true},
    {"id": "total_amount", "type": "formula", "label": "合計金額", "formula": "SUM(items.amount)"}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "購入明細", "fields": ["items", "total_amount"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T16';

-- T17: 稟議書
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "items", "type": "table", "label": "稟議明細", "columns": [
      {"id": "date", "type": "text", "label": "日付", "width": "15%"},
      {"id": "account", "type": "text", "label": "科目", "width": "20%"},
      {"id": "description", "type": "text", "label": "摘要", "width": "40%"},
      {"id": "amount", "type": "currency", "label": "金額（円）", "width": "18%"}
    ], "minRows": 1, "maxRows": 5, "allowExcelPaste": true},
    {"id": "total_amount", "type": "formula", "label": "合計金額", "formula": "SUM(items.amount)"}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "稟議明細", "fields": ["items", "total_amount"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T17';

-- T18: 経費精算
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "expenses", "type": "table", "label": "経費明細", "columns": [
      {"id": "date", "type": "text", "label": "日付", "width": "15%"},
      {"id": "account", "type": "text", "label": "勘定科目", "width": "20%"},
      {"id": "description", "type": "text", "label": "摘要", "width": "40%"},
      {"id": "amount", "type": "currency", "label": "金額（円）", "width": "18%"}
    ], "minRows": 1, "maxRows": 10, "allowExcelPaste": true},
    {"id": "total_amount", "type": "formula", "label": "合計金額", "formula": "SUM(expenses.amount)"}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "経費明細", "fields": ["expenses", "total_amount"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T18';

-- T19: 出荷証明書（汎用）
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "submit_to", "type": "text", "label": "提出先", "required": true},
    {"id": "submit_department", "type": "text", "label": "宛先部署", "required": false},
    {"id": "issue_date", "type": "date", "label": "日付", "required": true, "defaultValue": "today"},
    {"id": "customer_name", "type": "text", "label": "顧客名", "required": true},
    {"id": "project_name", "type": "text", "label": "案件名", "required": false},
    {"id": "shipping_destination", "type": "text", "label": "出荷先", "required": true},
    {"id": "shipping_date", "type": "date", "label": "出荷日", "required": true},
    {"id": "proposal_no", "type": "text", "label": "納品提案書NO", "required": false},
    {"id": "shipping_items", "type": "table", "label": "出荷商品明細", "columns": [
      {"id": "product_name", "type": "text", "label": "品名", "width": "45%"},
      {"id": "quantity", "type": "number", "label": "数量", "width": "15%"},
      {"id": "remarks", "type": "text", "label": "備考", "width": "40%"}
    ], "minRows": 1, "maxRows": 15, "allowExcelPaste": true},
    {"id": "total_quantity", "type": "formula", "label": "合計数量", "formula": "SUM(shipping_items.quantity)"},
    {"id": "shipment_count", "type": "number", "label": "発送件数", "required": false}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "宛先情報", "fields": ["submit_to", "submit_department", "issue_date"]},
      {"title": "出荷情報", "fields": ["customer_name", "project_name", "shipping_destination", "shipping_date", "proposal_no"]},
      {"title": "出荷商品明細", "fields": ["shipping_items", "total_quantity", "shipment_count"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T19';

-- T20: 商品納入証明書（汎用）
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "delivery_to", "type": "text", "label": "お届け先", "required": true},
    {"id": "company_name", "type": "text", "label": "社名", "required": false},
    {"id": "recipient", "type": "text", "label": "宛先（様）", "required": false},
    {"id": "responsible_person", "type": "text", "label": "責任者（所属・氏名）", "required": false},
    {"id": "delivery_date", "type": "date", "label": "納入日", "required": true},
    {"id": "product_items", "type": "table", "label": "商品明細", "columns": [
      {"id": "product_name", "type": "text", "label": "商品名", "width": "50%"},
      {"id": "quantity", "type": "number", "label": "数量", "width": "15%"},
      {"id": "remarks", "type": "text", "label": "摘要", "width": "35%"}
    ], "minRows": 1, "maxRows": 20, "allowExcelPaste": true}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "納入先情報", "fields": ["delivery_to", "company_name", "recipient", "responsible_person"]},
      {"title": "納入情報", "fields": ["delivery_date"]},
      {"title": "商品明細", "fields": ["product_items"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T20';

-- ============================================
-- Approval routes for all document types without one
-- ============================================
DO $$
DECLARE
  dt RECORD;
  rt_id UUID;
  kacho_id UUID;
  bucho_id UUID;
  jigyobucho_id UUID;
BEGIN
  SELECT id INTO kacho_id FROM positions WHERE code = 'KACHO';
  SELECT id INTO bucho_id FROM positions WHERE code = 'BUCHO';
  SELECT id INTO jigyobucho_id FROM positions WHERE code = 'JIGYOBUCHO';

  FOR dt IN
    SELECT id, code, name FROM document_types
    WHERE id NOT IN (SELECT document_type_id FROM approval_route_templates)
  LOOP
    INSERT INTO approval_route_templates (document_type_id, name, is_default)
    VALUES (dt.id, '標準承認ルート（3段階）', true)
    RETURNING id INTO rt_id;

    INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id) VALUES
      (rt_id, 1, '課長承認', 'position_in_department', kacho_id),
      (rt_id, 2, '部長承認', 'position_in_parent_department', bucho_id),
      (rt_id, 3, '事業部長承認', 'position_in_parent_department', jigyobucho_id);
  END LOOP;
END $$;

-- Grant access for new tables (in case new types were added)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated', t);
  END LOOP;
END
$$;
