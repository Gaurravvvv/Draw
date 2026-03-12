import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    objects: {
        type: [mongoose.Schema.Types.Mixed],
        default: [],
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Auto-update updatedAt on save
roomSchema.pre('save', function () {
    this.set({ updatedAt: new Date() });
});

export const Room = mongoose.model('Room', roomSchema);
