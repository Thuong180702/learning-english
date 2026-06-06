const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pureqrxixecxzyuuxtbm.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1cmVxcnhpeGVjeHp5dXV4dGJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMTUyNTcsImV4cCI6MjA5MTY5MTI1N30.QU17B3v9a271mv_BI29UqsMf4GUu-UP81WTcjHkJiGI';

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...\n');

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Test 1: Check connection
  console.log('1️⃣ Testing database connection...');
  try {
    const { data, error } = await supabase.from('videos').select('count').limit(1);
    if (error) {
      console.log('❌ Database connection failed:', error.message);
    } else {
      console.log('✅ Database connection successful');
    }
  } catch (err) {
    console.log('❌ Database connection error:', err.message);
  }

  // Test 2: Check videos table
  console.log('\n2️⃣ Testing videos table...');
  try {
    const { data, error } = await supabase.from('videos').select('*').limit(5);
    if (error) {
      console.log('❌ Videos table error:', error.message);
    } else {
      console.log(`✅ Videos table accessible (${data?.length || 0} rows fetched)`);
    }
  } catch (err) {
    console.log('❌ Videos table error:', err.message);
  }

  // Test 3: Check vocabulary table
  console.log('\n3️⃣ Testing vocabulary table...');
  try {
    const { data, error } = await supabase.from('vocabulary').select('*').limit(5);
    if (error) {
      console.log('❌ Vocabulary table error:', error.message);
    } else {
      console.log(`✅ Vocabulary table accessible (${data?.length || 0} rows fetched)`);
    }
  } catch (err) {
    console.log('❌ Vocabulary table error:', err.message);
  }

  // Test 4: Check auth
  console.log('\n4️⃣ Testing authentication...');
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.log('⚠️  No authenticated user (expected when not logged in)');
    } else if (user) {
      console.log('✅ User authenticated:', user.email);
    } else {
      console.log('⚠️  No user session');
    }
  } catch (err) {
    console.log('❌ Auth error:', err.message);
  }

  // Test 5: Check Google OAuth provider
  console.log('\n5️⃣ Testing Google OAuth configuration...');
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      console.log('❌ Google OAuth error:', error.message);
    } else if (data?.url) {
      console.log('✅ Google OAuth is configured correctly');
      console.log('   OAuth URL:', data.url.substring(0, 80) + '...');
    } else {
      console.log('⚠️  Google OAuth returned no URL');
    }
  } catch (err) {
    console.log('❌ OAuth error:', err.message);
  }

  console.log('\n✨ Test complete!\n');
}

testSupabaseConnection();
