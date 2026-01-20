const admin = require('firebase-admin');
const serviceAccount = require('./mlmplan-firebase-adminsdk-fbsvc-fc1bec0203.json');
const readline = require('readline');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const db = admin.firestore();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createAdmin() {
  try {
    console.log('\n=== Create Admin User ===\n');
    
    // Get admin details
    const email = await question('Enter admin email: ');
    const password = await question('Enter admin password (min 6 characters): ');
    const name = await question('Enter admin name: ');
    const refCode = await question('Enter referral code (or press Enter for auto-generated): ') || null;
    
    // Ask for role
    console.log('\nSelect role:');
    console.log('1. admin - Content and user management');
    console.log('2. superAdmin - Full access including deletion');
    const roleChoice = await question('Enter choice (1 or 2): ');
    const role = roleChoice === '2' ? 'superAdmin' : 'admin';
    
    // Validate password
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
    
    // Check if user already exists
    let user;
    try {
      user = await auth.getUserByEmail(email);
      console.log(`\n⚠️  User with email ${email} already exists. Updating...`);
      
      // Update password
      await auth.updateUser(user.uid, {
        password: password,
        displayName: name
      });
      
      console.log('✅ Password and display name updated');
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create new user
        user = await auth.createUser({
          email: email,
          password: password,
          displayName: name,
          emailVerified: true // Auto-verify for admin
        });
        console.log('✅ User created in Firebase Authentication');
      } else {
        throw error;
      }
    }
    
    // Generate ref code if not provided
    let finalRefCode = refCode;
    if (!finalRefCode) {
      // Generate a unique ref code
      const timestamp = Date.now().toString(36).toUpperCase();
      finalRefCode = `ADMIN${timestamp.slice(-6)}`;
    }
    
    // Check if ref code already exists
    const existingRefCode = await db.collection('users')
      .where('refCode', '==', finalRefCode.toUpperCase())
      .get();
    
    if (!existingRefCode.empty && existingRefCode.docs[0].id !== user.uid) {
      // Generate a new one if conflict
      const timestamp = Date.now().toString(36).toUpperCase();
      finalRefCode = `ADMIN${timestamp.slice(-6)}`;
      console.log(`⚠️  Ref code conflict, using: ${finalRefCode}`);
    }
    
    // Create or update user document in Firestore
    const userData = {
      name: name,
      email: email,
      refCode: finalRefCode.toUpperCase(),
      role: role,
      status: 'active',
      walletBalance: 0,
      pendingBalance: 0,
      lifetimeEarned: 0,
      lifetimeWithdrawn: 0,
      bankDetailsCompleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('users').doc(user.uid).set(userData, { merge: true });
    console.log('✅ User document created/updated in Firestore');
    
    console.log('\n=== Admin User Created Successfully ===\n');
    console.log('Credentials:');
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    console.log(`  Name: ${name}`);
    console.log(`  Role: ${role}`);
    console.log(`  Referral Code: ${finalRefCode.toUpperCase()}`);
    console.log(`  User ID: ${user.uid}`);
    console.log('\n✅ You can now login at: /admin/login\n');
    
  } catch (error) {
    console.error('\n❌ Error creating admin user:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the script
createAdmin();

