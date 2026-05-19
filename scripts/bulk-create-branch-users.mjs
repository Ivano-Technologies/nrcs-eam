import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env.local') })

const defaultPassword = process.env.BULK_USER_DEFAULT_PASSWORD
if (!defaultPassword) {
  console.error('BULK_USER_DEFAULT_PASSWORD environment variable is required')
  process.exit(1)
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const USERS = [
  'abia.umuahia@redcrossnigeria.org',
  'adamawa.yola@redcrossnigeria.org',
  'anambra.awka@redcrossnigeria.org',
  'abuja.fct@redcrossnigeria.org',
  'akwaibom.uyo@redcrossnigeria.org',
  'bayelsa.yenagoa@redcrossnigeria.org',
  'bauchi.bauchi@redcrossnigeria.org',
  'benue.makurdi@redcrossnigeria.org',
  'borno.maiduguri@redcrossnigeria.org',
  'crossriver.calabar@redcrossnigeria.org',
  'delta.asaba@redcrossnigeria.org',
  'enugu.enugu@redcrossnigeria.org',
  'ebonyi.abakaliki@redcrossnigeria.org',
  'edo.benin@redcrossnigeria.org',
  'ekiti.adoekiti@redcrossnigeria.org',
  'gombe.gombe@redcrossnigeria.org',
  'imo.owerri@redcrossnigeria.org',
  'jigawa.dutse@redcrossnigeria.org',
  'kebbi.birninkebbi@redcrossnigeria.org',
  'kano.kano@redcrossnigeria.org',
  'kaduna.kaduna@redcrossnigeria.org',
  'katsina.katsina@redcrossnigeria.org',
  'kwara.ilorin@redcrossnigeria.org',
  'kogi.lokoja@redcrossnigeria.org',
  'osun.oshogbo@redcrossnigeria.org',
  'ogun.abeokuta@redcrossnigeria.org',
  'ondo.akure@redcrossnigeria.org',
  'oyo.ibadan@redcrossnigeria.org',
  'lagos.ikeja@redcrossnigeria.org',
  'nassarawa.lafia@redcrossnigeria.org',
  'rivers.portharcourt@redcrossnigeria.org',
  'niger.minna@redcrossnigeria.org',
  'plateau.jos@redcrossnigeria.org',
  'sokoto.sokoto@redcrossnigeria.org',
  'taraba.jalingo@redcrossnigeria.org',
  'yobe.damaturu@redcrossnigeria.org',
  'zamfara.gusau@redcrossnigeria.org',
]

for (const email of USERS) {
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: defaultPassword,
    email_confirm: true,
  })

  if (authError && !authError.message.includes('already registered')) {
    console.error(`FAIL (auth)  ${email}: ${authError.message}`)
    continue
  }

  if (authError?.message.includes('already registered')) {
    console.warn(`SKIP (auth)  ${email}: already exists`)
  } else {
    console.log(`OK   (auth)  ${email}`)
  }

  const openId =
    authData?.user?.id ??
    (await supabase.auth.admin.getUserByEmail(email).then((r) => r.data.user?.id))

  const { error: dbError } = await supabase.from('users').upsert(
    {
      email,
      role: 'staff',
      status: 'active',
      openId,
      must_change_password_on_login: true,
    },
    { onConflict: 'email' }
  )

  if (dbError) {
    console.error(`FAIL (db)    ${email}: ${dbError.message}`)
  } else {
    console.log(`OK   (db)    ${email}`)
  }
}

console.log('\nDone.')
