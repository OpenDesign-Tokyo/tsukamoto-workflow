/**
 * QA自動テストスクリプト
 * 実行: npx tsx scripts/qa-test.ts
 */

const SUPABASE_URL = 'https://kedzmovbpkgcsntjhnmd.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlZHptb3ZicGtnY3NudGpobm1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMTc4ODUsImV4cCI6MjA4NzU5Mzg4NX0._UuhhX_MEScaMKjUHBXilDagK8dNfg7O1UM85NxSwqI'
const BASE_URL = 'https://tsukamoto-workflow.vercel.app'

interface TestResult {
  name: string
  passed: boolean
  error?: string
  details?: string
}

const results: TestResult[] = []

function pass(name: string, details?: string) {
  results.push({ name, passed: true, details })
}

function fail(name: string, error: string, details?: string) {
  results.push({ name, passed: false, error, details })
}

async function supabaseQuery(table: string, params: string = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Accept': 'application/json',
    },
  })
  if (!res.ok) {
    throw new Error(`Supabase ${table}: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

async function apiCall(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    },
  })
  const body = await res.json().catch(() => null)
  return { status: res.status, ok: res.ok, body }
}

// ============================================
// テスト実行
// ============================================

async function run() {
  console.log('🔍 QAテスト開始...\n')

  // ------------------------------------------
  // 1. DB データ整合性
  // ------------------------------------------
  console.log('📦 1. データベース整合性チェック')

  // 1-1: 従業員データ
  try {
    const employees = await supabaseQuery('employees', 'select=*&is_active=eq.true')
    if (employees.length >= 6) {
      pass('1-1 従業員データ', `${employees.length}名のアクティブ従業員`)
    } else {
      fail('1-1 従業員データ', `従業員が${employees.length}名しかいない（6名以上必要）`)
    }
  } catch (e: any) {
    fail('1-1 従業員データ', e.message)
  }

  // 1-2: 部署データ
  try {
    const depts = await supabaseQuery('departments', 'select=*&is_active=eq.true')
    if (depts.length >= 3) {
      pass('1-2 部署データ', `${depts.length}部署`)
    } else {
      fail('1-2 部署データ', `部署が${depts.length}しかない`)
    }
  } catch (e: any) {
    fail('1-2 部署データ', e.message)
  }

  // 1-3: 役職データ
  try {
    const positions = await supabaseQuery('positions', 'select=*')
    if (positions.length >= 3) {
      pass('1-3 役職データ', `${positions.length}役職`)
    } else {
      fail('1-3 役職データ', `役職が${positions.length}しかない`)
    }
  } catch (e: any) {
    fail('1-3 役職データ', e.message)
  }

  // 1-4: 従業員所属データ
  try {
    const assignments = await supabaseQuery('employee_assignments', 'select=*&is_active=eq.true&is_primary=eq.true')
    if (assignments.length >= 6) {
      pass('1-4 従業員所属', `${assignments.length}件のプライマリ所属`)
    } else {
      fail('1-4 従業員所属', `プライマリ所属が${assignments.length}件しかない（6件以上必要）`)
    }
  } catch (e: any) {
    fail('1-4 従業員所属', e.message)
  }

  // 1-5: 書類種別
  try {
    const docTypes = await supabaseQuery('document_types', 'select=*&is_active=eq.true')
    if (docTypes.length >= 10) {
      pass('1-5 書類種別', `${docTypes.length}種別`)
    } else {
      fail('1-5 書類種別', `書類種別が${docTypes.length}しかない（10以上期待）`)
    }
  } catch (e: any) {
    fail('1-5 書類種別', e.message)
  }

  // 1-6: フォームテンプレート
  try {
    const templates = await supabaseQuery('form_templates', 'select=id,document_type_id,is_current&is_current=eq.true')
    const docTypes = await supabaseQuery('document_types', 'select=id&is_active=eq.true')
    const templateTypeIds = new Set(templates.map((t: any) => t.document_type_id))
    const missingTypes = docTypes.filter((d: any) => !templateTypeIds.has(d.id))
    if (missingTypes.length === 0) {
      pass('1-6 フォームテンプレート', `全${templates.length}種別にテンプレートあり`)
    } else {
      fail('1-6 フォームテンプレート', `${missingTypes.length}件の書類種別にテンプレートがない`, JSON.stringify(missingTypes.map((d: any) => d.id)))
    }
  } catch (e: any) {
    fail('1-6 フォームテンプレート', e.message)
  }

  // 1-7: 承認ルートテンプレート
  try {
    const routes = await supabaseQuery('approval_route_templates', 'select=id,document_type_id,is_default,is_active&is_active=eq.true&is_default=eq.true')
    const docTypes = await supabaseQuery('document_types', 'select=id&is_active=eq.true')
    const routeTypeIds = new Set(routes.map((r: any) => r.document_type_id))
    const missingRoutes = docTypes.filter((d: any) => !routeTypeIds.has(d.id))
    if (missingRoutes.length === 0) {
      pass('1-7 承認ルート', `全${routes.length}種別にデフォルトルートあり`)
    } else {
      fail('1-7 承認ルート', `${missingRoutes.length}件の書類種別にデフォルトルートがない`)
    }
  } catch (e: any) {
    fail('1-7 承認ルート', e.message)
  }

  // 1-8: 承認ルートステップ
  try {
    const routes = await supabaseQuery('approval_route_templates', 'select=id&is_active=eq.true')
    let emptyRoutes = 0
    for (const route of routes) {
      const steps = await supabaseQuery('approval_route_steps', `select=id&route_template_id=eq.${route.id}`)
      if (steps.length === 0) emptyRoutes++
    }
    if (emptyRoutes === 0) {
      pass('1-8 承認ルートステップ', `全ルートにステップあり`)
    } else {
      fail('1-8 承認ルートステップ', `${emptyRoutes}件のルートにステップがない`)
    }
  } catch (e: any) {
    fail('1-8 承認ルートステップ', e.message)
  }

  // 1-9: フォームスキーマの妥当性
  try {
    const templates = await supabaseQuery('form_templates', 'select=id,schema,document_type_id&is_current=eq.true')
    let invalidCount = 0
    const invalidDetails: string[] = []
    for (const t of templates) {
      const schema = t.schema
      if (!schema || !schema.fields || !Array.isArray(schema.fields)) {
        invalidCount++
        invalidDetails.push(`template ${t.id}: schemaにfieldsがない`)
      } else if (schema.fields.length === 0) {
        invalidCount++
        invalidDetails.push(`template ${t.id}: fieldsが空`)
      }
    }
    if (invalidCount === 0) {
      pass('1-9 フォームスキーマ妥当性', `全${templates.length}テンプレートのスキーマが有効`)
    } else {
      fail('1-9 フォームスキーマ妥当性', `${invalidCount}件のスキーマが不正`, invalidDetails.join('; '))
    }
  } catch (e: any) {
    fail('1-9 フォームスキーマ妥当性', e.message)
  }

  // ------------------------------------------
  // 2. デモユーザー取得
  // ------------------------------------------
  console.log('\n👤 2. ユーザー認証・取得')

  let tanaka: any = null
  let sato: any = null
  let takahashi: any = null
  let admin: any = null

  try {
    const employees = await supabaseQuery('employees', 'select=*&is_active=eq.true')
    tanaka = employees.find((e: any) => e.email === 'tanaka@tsukamoto-demo.com')
    sato = employees.find((e: any) => e.email === 'sato@tsukamoto-demo.com')
    takahashi = employees.find((e: any) => e.email === 'takahashi@tsukamoto-demo.com')
    admin = employees.find((e: any) => e.email === 'admin@tsukamoto-demo.com')

    if (tanaka) pass('2-1 田中（申請者）', tanaka.id)
    else fail('2-1 田中（申請者）', 'tanaka@tsukamoto-demo.com が見つからない')

    if (sato) pass('2-2 佐藤（課長）', sato.id)
    else fail('2-2 佐藤（課長）', 'sato@tsukamoto-demo.com が見つからない')

    if (takahashi) pass('2-3 高橋（部長）', takahashi.id)
    else fail('2-3 高橋（部長）', 'takahashi@tsukamoto-demo.com が見つからない')

    if (admin) pass('2-4 管理者', admin.id)
    else fail('2-4 管理者', 'admin@tsukamoto-demo.com が見つからない')
  } catch (e: any) {
    fail('2-1 デモユーザー取得', e.message)
  }

  // 2-5: 各ユーザーの所属確認
  if (tanaka) {
    try {
      const assignments = await supabaseQuery('employee_assignments',
        `select=*,department:departments(name),position:positions(name)&employee_id=eq.${tanaka.id}&is_primary=eq.true&is_active=eq.true`)
      if (assignments.length === 1) {
        pass('2-5 田中の所属', `${assignments[0].department?.name} / ${assignments[0].position?.name}`)
      } else {
        fail('2-5 田中の所属', `プライマリ所属が${assignments.length}件（1件必要）`)
      }
    } catch (e: any) {
      fail('2-5 田中の所属', e.message)
    }
  }

  // ------------------------------------------
  // 3. API エンドポイントテスト
  // ------------------------------------------
  console.log('\n🌐 3. APIエンドポイント')

  if (!tanaka) {
    fail('3-x API テスト', '田中ユーザーが見つからないためスキップ')
  } else {
    // 3-1: 申請一覧取得
    try {
      const res = await apiCall('/api/applications', {
        headers: { 'X-Demo-User-Id': tanaka.id },
      })
      if (res.ok && Array.isArray(res.body)) {
        pass('3-1 GET /api/applications', `${res.body.length}件取得`)
      } else {
        fail('3-1 GET /api/applications', `status=${res.status}`, JSON.stringify(res.body))
      }
    } catch (e: any) {
      fail('3-1 GET /api/applications', e.message)
    }

    // 3-2: 書類種別から最初のものでフォームテンプレート取得
    let testDocTypeId: string | null = null
    let testTemplateId: string | null = null
    try {
      const docTypes = await supabaseQuery('document_types', 'select=id,code,name&is_active=eq.true&order=code')
      if (docTypes.length > 0) {
        testDocTypeId = docTypes[0].id
        const templates = await supabaseQuery('form_templates',
          `select=id&document_type_id=eq.${testDocTypeId}&is_current=eq.true`)
        if (templates.length > 0) {
          testTemplateId = templates[0].id
          pass('3-2 テスト用テンプレート取得', `docType=${docTypes[0].code}, template=${testTemplateId}`)
        } else {
          fail('3-2 テスト用テンプレート取得', 'テンプレートが見つからない')
        }
      }
    } catch (e: any) {
      fail('3-2 テスト用テンプレート取得', e.message)
    }

    // 3-3: 新規申請（下書き）
    let draftAppId: string | null = null
    if (testDocTypeId && testTemplateId) {
      try {
        const res = await apiCall('/api/applications', {
          method: 'POST',
          headers: { 'X-Demo-User-Id': tanaka.id },
          body: JSON.stringify({
            document_type_id: testDocTypeId,
            form_template_id: testTemplateId,
            form_data: { test_field: 'QAテストデータ' },
            title: 'QAテスト申請（自動）',
            submit: false,
          }),
        })
        if (res.ok && res.body?.id) {
          draftAppId = res.body.id
          pass('3-3 POST 下書き作成', `id=${draftAppId}, status=${res.body.status}`)
        } else {
          fail('3-3 POST 下書き作成', `status=${res.status}`, JSON.stringify(res.body))
        }
      } catch (e: any) {
        fail('3-3 POST 下書き作成', e.message)
      }
    }

    // 3-4: 下書き取得
    if (draftAppId) {
      try {
        const res = await apiCall(`/api/applications/${draftAppId}`, {
          headers: { 'X-Demo-User-Id': tanaka.id },
        })
        if (res.ok && res.body?.status === 'draft') {
          pass('3-4 GET 下書き詳細', `status=draft`)
        } else {
          fail('3-4 GET 下書き詳細', `status=${res.status}, body.status=${res.body?.status}`)
        }
      } catch (e: any) {
        fail('3-4 GET 下書き詳細', e.message)
      }
    }

    // 3-5: 下書き編集
    if (draftAppId) {
      try {
        const res = await apiCall(`/api/applications/${draftAppId}`, {
          method: 'PUT',
          headers: { 'X-Demo-User-Id': tanaka.id },
          body: JSON.stringify({
            form_data: { test_field: 'QAテストデータ（編集済み）' },
            title: 'QAテスト申請（編集済み）',
            submit: false,
          }),
        })
        if (res.ok) {
          pass('3-5 PUT 下書き編集', `title=${res.body?.title}`)
        } else {
          fail('3-5 PUT 下書き編集', `status=${res.status}`, JSON.stringify(res.body))
        }
      } catch (e: any) {
        fail('3-5 PUT 下書き編集', e.message)
      }
    }

    // 3-6: 申請送信
    let submittedAppId: string | null = null
    if (testDocTypeId && testTemplateId) {
      try {
        const res = await apiCall('/api/applications', {
          method: 'POST',
          headers: { 'X-Demo-User-Id': tanaka.id },
          body: JSON.stringify({
            document_type_id: testDocTypeId,
            form_template_id: testTemplateId,
            form_data: { test_field: 'QAテスト承認フロー' },
            title: 'QAテスト承認フロー',
            submit: true,
          }),
        })
        if (res.ok && res.body?.id) {
          submittedAppId = res.body.id
          const wf = res.body.workflow
          if (wf?.success) {
            pass('3-6 POST 申請送信', `id=${submittedAppId}, 第1承認者=${wf.firstApprover?.employeeName}`)
          } else {
            fail('3-6 POST 申請送信', `ワークフロー開始失敗: ${wf?.error}`, JSON.stringify(res.body))
          }
        } else {
          fail('3-6 POST 申請送信', `status=${res.status}`, JSON.stringify(res.body))
        }
      } catch (e: any) {
        fail('3-6 POST 申請送信', e.message)
      }
    }

    // 3-7: 承認レコード確認
    if (submittedAppId) {
      try {
        const records = await supabaseQuery('approval_records',
          `select=*,approver:employees!approver_id(name,email)&application_id=eq.${submittedAppId}&order=step_order`)
        if (records.length >= 1 && records[0].action === 'pending') {
          pass('3-7 承認レコード', `${records.length}件、第1ステップ=pending, 承認者=${records[0].approver?.name}`)
        } else {
          fail('3-7 承認レコード', `レコード${records.length}件`, JSON.stringify(records))
        }
      } catch (e: any) {
        fail('3-7 承認レコード', e.message)
      }
    }

    // 3-8: 承認実行（第1承認者=佐藤課長）
    if (submittedAppId && sato) {
      try {
        const res = await apiCall(`/api/applications/${submittedAppId}/approve`, {
          method: 'POST',
          headers: { 'X-Demo-User-Id': sato.id },
          body: JSON.stringify({ comment: 'QAテスト承認OK' }),
        })
        if (res.ok) {
          pass('3-8 POST 第1承認', `result=${JSON.stringify(res.body)}`)
        } else {
          fail('3-8 POST 第1承認', `status=${res.status}`, JSON.stringify(res.body))
        }
      } catch (e: any) {
        fail('3-8 POST 第1承認', e.message)
      }
    }

    // 3-9: 承認後のステータス確認
    if (submittedAppId) {
      try {
        const res = await apiCall(`/api/applications/${submittedAppId}`, {
          headers: { 'X-Demo-User-Id': tanaka.id },
        })
        const status = res.body?.status
        const currentStep = res.body?.current_step
        const totalSteps = res.body?.total_steps
        if (status === 'in_approval' || status === 'approved') {
          pass('3-9 第1承認後ステータス', `status=${status}, step=${currentStep}/${totalSteps}`)
        } else {
          fail('3-9 第1承認後ステータス', `unexpected status=${status}`, JSON.stringify({ status, currentStep, totalSteps }))
        }
      } catch (e: any) {
        fail('3-9 第1承認後ステータス', e.message)
      }
    }

    // 3-10: 通知確認
    if (submittedAppId && sato) {
      try {
        const notifications = await supabaseQuery('notifications',
          `select=*&application_id=eq.${submittedAppId}&order=sent_at.desc`)
        if (notifications.length >= 1) {
          pass('3-10 通知生成', `${notifications.length}件の通知: ${notifications.map((n: any) => `${n.type}: ${n.title}`).join('; ')}`)
        } else {
          fail('3-10 通知生成', '通知が生成されていない')
        }
      } catch (e: any) {
        fail('3-10 通知生成', e.message)
      }
    }

    // 3-11: 取下げテスト（新しい申請を作って取下げ）
    if (testDocTypeId && testTemplateId) {
      try {
        const createRes = await apiCall('/api/applications', {
          method: 'POST',
          headers: { 'X-Demo-User-Id': tanaka.id },
          body: JSON.stringify({
            document_type_id: testDocTypeId,
            form_template_id: testTemplateId,
            form_data: { test_field: 'QA取下げテスト' },
            title: 'QAテスト取下げ用',
            submit: true,
          }),
        })
        if (createRes.ok && createRes.body?.id) {
          const withdrawRes = await apiCall(`/api/applications/${createRes.body.id}/withdraw`, {
            method: 'POST',
            headers: { 'X-Demo-User-Id': tanaka.id },
          })
          if (withdrawRes.ok) {
            // ステータス確認
            const checkRes = await apiCall(`/api/applications/${createRes.body.id}`, {
              headers: { 'X-Demo-User-Id': tanaka.id },
            })
            if (checkRes.body?.status === 'withdrawn') {
              pass('3-11 取下げ', 'status=withdrawn')
            } else {
              fail('3-11 取下げ', `取下げ後status=${checkRes.body?.status}`)
            }
          } else {
            fail('3-11 取下げ', `withdraw status=${withdrawRes.status}`, JSON.stringify(withdrawRes.body))
          }
        } else {
          fail('3-11 取下げ', `申請作成失敗: ${createRes.status}`)
        }
      } catch (e: any) {
        fail('3-11 取下げ', e.message)
      }
    }

    // 3-12: 差戻しテスト
    if (testDocTypeId && testTemplateId && sato) {
      try {
        const createRes = await apiCall('/api/applications', {
          method: 'POST',
          headers: { 'X-Demo-User-Id': tanaka.id },
          body: JSON.stringify({
            document_type_id: testDocTypeId,
            form_template_id: testTemplateId,
            form_data: { test_field: 'QA差戻しテスト' },
            title: 'QAテスト差戻し用',
            submit: true,
          }),
        })
        if (createRes.ok && createRes.body?.id) {
          const rejectRes = await apiCall(`/api/applications/${createRes.body.id}/reject`, {
            method: 'POST',
            headers: { 'X-Demo-User-Id': sato.id },
            body: JSON.stringify({ comment: 'QAテスト差戻し理由' }),
          })
          if (rejectRes.ok) {
            const checkRes = await apiCall(`/api/applications/${createRes.body.id}`, {
              headers: { 'X-Demo-User-Id': tanaka.id },
            })
            if (checkRes.body?.status === 'rejected') {
              pass('3-12 差戻し', 'status=rejected')

              // 3-13: 再申請テスト
              const resubmitRes = await apiCall(`/api/applications/${createRes.body.id}`, {
                method: 'PUT',
                headers: { 'X-Demo-User-Id': tanaka.id },
                body: JSON.stringify({
                  form_data: { test_field: 'QA再申請データ' },
                  title: 'QAテスト再申請',
                  submit: true,
                }),
              })
              if (resubmitRes.ok) {
                const resubCheck = await apiCall(`/api/applications/${createRes.body.id}`, {
                  headers: { 'X-Demo-User-Id': tanaka.id },
                })
                if (resubCheck.body?.status === 'in_approval') {
                  pass('3-13 再申請', 'status=in_approval')
                } else {
                  fail('3-13 再申請', `再申請後status=${resubCheck.body?.status}`)
                }
              } else {
                fail('3-13 再申請', `resubmit status=${resubmitRes.status}`, JSON.stringify(resubmitRes.body))
              }
            } else {
              fail('3-12 差戻し', `差戻し後status=${checkRes.body?.status}`)
            }
          } else {
            fail('3-12 差戻し', `reject status=${rejectRes.status}`, JSON.stringify(rejectRes.body))
          }
        }
      } catch (e: any) {
        fail('3-12 差戻し', e.message)
      }
    }

    // 3-14: 権限チェック - 他人の申請を編集できないこと
    if (draftAppId && sato) {
      try {
        const res = await apiCall(`/api/applications/${draftAppId}`, {
          method: 'PUT',
          headers: { 'X-Demo-User-Id': sato.id },
          body: JSON.stringify({
            form_data: { test_field: '不正編集' },
            title: '不正編集テスト',
          }),
        })
        if (res.status === 403) {
          pass('3-14 権限チェック（他人編集拒否）', 'status=403')
        } else {
          fail('3-14 権限チェック（他人編集拒否）', `status=${res.status}（403が期待）`)
        }
      } catch (e: any) {
        fail('3-14 権限チェック', e.message)
      }
    }
  }

  // ------------------------------------------
  // 4. 管理API
  // ------------------------------------------
  console.log('\n⚙️  4. 管理API')

  // 4-1: 部署一覧
  try {
    const res = await apiCall('/api/admin/departments')
    if (res.ok && Array.isArray(res.body)) {
      pass('4-1 GET 部署一覧', `${res.body.length}件`)
    } else {
      fail('4-1 GET 部署一覧', `status=${res.status}`)
    }
  } catch (e: any) {
    fail('4-1 GET 部署一覧', e.message)
  }

  // 4-2: 従業員一覧
  try {
    const res = await apiCall('/api/admin/employees')
    if (res.ok && Array.isArray(res.body)) {
      pass('4-2 GET 従業員一覧', `${res.body.length}件`)
    } else {
      fail('4-2 GET 従業員一覧', `status=${res.status}`)
    }
  } catch (e: any) {
    fail('4-2 GET 従業員一覧', e.message)
  }

  // 4-3: 承認ルート一覧
  try {
    const res = await apiCall('/api/admin/routes')
    if (res.ok && Array.isArray(res.body)) {
      pass('4-3 GET 承認ルート一覧', `${res.body.length}件`)
    } else {
      fail('4-3 GET 承認ルート一覧', `status=${res.status}`)
    }
  } catch (e: any) {
    fail('4-3 GET 承認ルート一覧', e.message)
  }

  // 4-4: テンプレート一覧
  try {
    const res = await apiCall('/api/admin/templates')
    if (res.ok && Array.isArray(res.body)) {
      pass('4-4 GET テンプレート一覧', `${res.body.length}件`)
    } else {
      fail('4-4 GET テンプレート一覧', `status=${res.status}`)
    }
  } catch (e: any) {
    fail('4-4 GET テンプレート一覧', e.message)
  }

  // ------------------------------------------
  // 5. ページ疎通確認
  // ------------------------------------------
  console.log('\n🌍 5. ページ疎通')

  const pages = [
    '/',
    '/applications',
    '/applications/new',
    '/approvals',
    '/archive',
    '/admin/org',
    '/admin/users',
    '/admin/routes',
    '/admin/forms',
  ]

  for (const page of pages) {
    try {
      const res = await fetch(`${BASE_URL}${page}`, { redirect: 'follow' })
      if (res.ok) {
        pass(`5-${pages.indexOf(page) + 1} ${page}`, `status=${res.status}`)
      } else {
        fail(`5-${pages.indexOf(page) + 1} ${page}`, `status=${res.status}`)
      }
    } catch (e: any) {
      fail(`5-${pages.indexOf(page) + 1} ${page}`, e.message)
    }
  }

  // ------------------------------------------
  // 6. クリーンアップ: テストデータ削除
  // ------------------------------------------
  console.log('\n🧹 6. テストデータクリーンアップ')
  try {
    const testApps = await supabaseQuery('applications', `select=id&title=like.*QA*`)
    if (testApps.length > 0) {
      for (const app of testApps) {
        // 承認レコード削除
        await fetch(`${SUPABASE_URL}/rest/v1/approval_records?application_id=eq.${app.id}`, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        })
        // 通知削除
        await fetch(`${SUPABASE_URL}/rest/v1/notifications?application_id=eq.${app.id}`, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        })
        // 申請削除
        await fetch(`${SUPABASE_URL}/rest/v1/applications?id=eq.${app.id}`, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        })
      }
      pass('6-1 テストデータ削除', `${testApps.length}件削除`)
    } else {
      pass('6-1 テストデータ削除', '削除対象なし')
    }
  } catch (e: any) {
    fail('6-1 テストデータ削除', e.message)
  }

  // ------------------------------------------
  // 結果出力
  // ------------------------------------------
  console.log('\n' + '='.repeat(60))
  console.log('📊 テスト結果')
  console.log('='.repeat(60))

  const passed = results.filter(r => r.passed)
  const failed = results.filter(r => !r.passed)

  for (const r of results) {
    const icon = r.passed ? '✅' : '❌'
    console.log(`${icon} ${r.name}`)
    if (r.details) console.log(`   ${r.details}`)
    if (r.error) console.log(`   ⚠️  ${r.error}`)
  }

  console.log('\n' + '-'.repeat(60))
  console.log(`合計: ${results.length}件 | ✅ ${passed.length}件 | ❌ ${failed.length}件`)
  console.log('-'.repeat(60))

  if (failed.length > 0) {
    console.log('\n❌ 不合格項目:')
    for (const f of failed) {
      console.log(`  - ${f.name}: ${f.error}`)
      if (f.details) console.log(`    詳細: ${f.details}`)
    }
  }

  process.exit(failed.length > 0 ? 1 : 0)
}

run().catch((e) => {
  console.error('テスト実行エラー:', e)
  process.exit(2)
})
