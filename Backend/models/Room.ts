import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    /** Raster command log (array of StrokeCommand objects) */
    objects: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    /** Overlay text objects */
    texts: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    /** Canvas background color (CSS color string) */
    backgroundColor: {
      type: String,
      default: '#FFFFFF',
    },
    /** Canvas background pattern */
    backgroundPattern: {
      type: String,
      enum: ['none', 'grid', 'dots', 'lines'],
      default: 'none',
    },
    /** URL to latest canvas snapshot (S3/local storage) — for fast initial load */
    canvasImageUrl: {
      type: String,
      default: null,
    },
  },
  {
    // Q4 FIX: Use Mongoose built-in timestamps instead of dead pre('save') hook.
    // findOneAndUpdate (used in debouncedSave) never triggered pre('save'),
    // so the old hook was dead code.
    timestamps: true,
  }
);

export const Room = mongoose.model('Room', roomSchema);
