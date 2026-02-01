import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, // Optional, only for manual users
    required: false 
  },
  googleId: { 
    type: String, // Optional, only for Google users
    required: false 
  },
  profilePicture: { 
    type: String, 
    required: false 
  }
});

export const User = mongoose.model('User', userSchema);