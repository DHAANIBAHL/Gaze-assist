# GazeAssist - Complete Usage Guide

## Quick Start

1. **Open the application**: Navigate to `http://localhost:3000` after running `npm start`
2. **Allow camera access**: Grant camera permissions when prompted
3. **Wait for initialization**: AI models will load (10-20 seconds)
4. **Start calibration**: Click "Start Calibration" button
5. **Follow calibration points**: Look at each of the 9 green circles
6. **Use gaze control**: Control the cursor with your eyes!

## Detailed Calibration Process

### Step 1: Preparation
- **Camera Position**: Place at eye level, not looking up or down
- **Lighting**: Face a window or light source, avoid backlighting
- **Distance**: Sit 50-70cm (20-28 inches) from the screen
- **Posture**: Sit comfortably with stable head position

### Step 2: Calibration Points
The system will show 9 points in this order:
```
1 (Top-Left)     2 (Top-Center)     3 (Top-Right)
4 (Middle-Left)  5 (Center)         6 (Middle-Right)
7 (Bottom-Left)  8 (Bottom-Center)  9 (Bottom-Right)
```

### Step 3: For Each Point
1. **Green Circle** appears - Look at it and keep your gaze steady
2. **Wait 2 seconds** - System prepares to collect data
3. **Blue Circle** appears - Data collection in progress (1 second)
4. **Progress Ring** fills around the circle
5. **Next Point** appears automatically

### Step 4: Completion
- "Calibration Complete!" message appears
- Automatically redirected to Gaze Control page
- Your calibration data is saved for the session

## Using Gaze Control

### Cursor Movement
- **Move your eyes** - The blue cursor follows your gaze
- **Look at edges** - Cursor maps to full screen area
- **Small movements** - Make fine adjustments with small eye movements

### Clicking Methods

#### Method 1: Dwell-Time Click (Default)
1. Look at a button or link
2. Keep your gaze steady in one spot
3. Watch the blue ring fill around the cursor (1.5 seconds)
4. Click triggers automatically when ring completes

**Tips for Dwell Clicking:**
- Stay within a small area (30 pixels radius)
- If you move too far, the timer resets
- Practice on large buttons first

#### Method 2: Pinch Gesture
1. Show your hand to the camera
2. Bring thumb and index finger together
3. Click triggers instantly when fingers touch
4. Release and repeat for multiple clicks

**Tips for Pinch Gesture:**
- Keep hand visible to camera (top-right video feed)
- Make clear pinching motion
- Wait briefly between clicks

#### Method 3: Open Palm (Reset)
- Extend all fingers upward
- Useful to cancel accidental clicks
- Resets dwell timer

## Interface Elements

### Status Bar (Top-Left)
- **Green Indicator**: Face is detected
- **Gray Indicator**: No face detected
- **Gesture Label**: Shows current hand gesture
- **Recalibrate Button**: Start calibration again

### Video Feed (Top-Right)
- Shows your camera feed
- Confirms face and hand detection
- Check positioning and lighting

### Info Panel (Bottom-Center)
- Current mode and instructions
- Control tips and shortcuts
- Dismiss to see more of screen

## Advanced Tips

### Improving Accuracy

1. **Recalibrate Regularly**
   - After changing lighting
   - After adjusting screen angle
   - When accuracy decreases
   - Every 30-60 minutes of use

2. **Optimize Environment**
   - Use consistent lighting
   - Minimize head movement
   - Remove distractions in background
   - Use good quality webcam

3. **Practice Technique**
   - Start with large buttons
   - Practice smooth eye movements
   - Learn your personal dwell time
   - Experiment with gaze angles

### Performance Optimization

**For Better Frame Rate:**
- Close unnecessary browser tabs
- Use Chrome or Edge browser
- Disable browser extensions temporarily
- Ensure adequate RAM available

**For Better Accuracy:**
- Use HD webcam (720p minimum)
- Ensure lens is clean
- Good, even facial lighting
- Stable seating position

## Troubleshooting

### Issue: Cursor is jumpy or erratic
**Solutions:**
- Recalibrate the system
- Check lighting (avoid shadows on face)
- Keep head more still
- Sit at proper distance from screen

### Issue: Clicks not registering
**Solutions:**
- Hold gaze longer in same spot
- Check dwell ring is filling
- Try pinch gesture instead
- Ensure you're within dwell threshold (30px)

### Issue: Face not detected
**Solutions:**
- Check camera permissions
- Ensure good lighting on face
- Remove glasses if causing issues
- Move closer to camera
- Refresh the page

### Issue: Hand gestures not working
**Solutions:**
- Show hand clearly to camera
- Check video feed (top-right)
- Make exaggerated gestures
- Ensure adequate lighting on hand
- Try different hand angles

### Issue: Poor performance/lag
**Solutions:**
- Close other applications
- Use hardware acceleration in browser
- Lower screen resolution temporarily
- Restart browser
- Try different browser (Chrome recommended)

## Calibration Tips

### When to Recalibrate
- First time using system
- After moving camera
- After changing seat position
- When lighting changes significantly
- When accuracy decreases
- After system has been idle

### Getting Best Calibration
1. **Preparation is key**: Set up properly before starting
2. **Focus carefully**: Look at center of each circle
3. **Hold steady**: Don't move during data collection
4. **Complete all points**: Don't skip or rush
5. **Test afterwards**: Move eyes around to verify accuracy

### Calibration Quality Check
After calibration, test by:
- Looking at all four corners
- Looking at screen center
- Making smooth scanning motions
- Attempting to click various elements

If cursor doesn't follow well, recalibrate immediately.

## Accessibility Features

### For Users with Limited Mobility
- Completely hands-free operation possible
- Dwell-time clicking requires no physical input
- Adjustable sensitivity (code-level)
- Works with various physical positions

### For Users with Hand Tremors
- Gaze control unaffected by hand movement
- Dwell-time more reliable than pinch
- Smoothing algorithm reduces jitter

### For Different Abilities
- Multiple input methods (gaze + gestures)
- Visual feedback for all actions
- Clear status indicators
- Forgiving dwell threshold

## Best Practices

### For Extended Use
1. Take breaks every 20-30 minutes
2. Recalibrate periodically
3. Adjust position if uncomfortable
4. Stay hydrated (helps eye focusing)

### For Accurate Control
1. Move eyes smoothly, not rapidly
2. Focus on target before clicking
3. Use larger UI elements when possible
4. Practice with non-critical actions first

### For Comfort
1. Maintain proper posture
2. Screen at eye level
3. Adequate ambient lighting
4. Regular eye rest breaks

## Technical Details

### System Requirements
- **Browser**: Chrome 90+, Edge 90+, Firefox 88+, Safari 14+
- **Camera**: 720p webcam minimum (1080p recommended)
- **RAM**: 4GB minimum (8GB recommended)
- **Processor**: Dual-core 2.0GHz minimum
- **Internet**: Required for initial model loading

### Data Collection
- 30 samples per calibration point
- ~270 total samples for 9 points
- Calibration takes ~25-30 seconds
- Data stored in browser session only

### Tracking Specifications
- **Frame Rate**: ~30 FPS
- **Latency**: <50ms typical
- **Accuracy**: 2-5cm on screen (after calibration)
- **Smoothing**: Exponential (factor: 0.3)
- **Dwell Time**: 1.5 seconds default

## FAQ

**Q: Can I use this with glasses?**
A: Yes, but may require additional calibration. Remove glasses if accuracy is poor.

**Q: Does it work in low light?**
A: Face detection requires adequate lighting. Use desk lamp if needed.

**Q: Is calibration data saved?**
A: Calibration persists for the browser session only. Closing the tab requires recalibration.

**Q: Can multiple people use the same calibration?**
A: No, calibration is person-specific. Each user needs their own calibration.

**Q: What's the ideal distance from screen?**
A: 50-70cm (20-28 inches) works best for most setups.

**Q: Can I adjust dwell time?**
A: Currently hardcoded at 1.5 seconds. Check code to modify (DWELL_TIME constant).

**Q: Why is my cursor offset from my gaze?**
A: Recalibrate the system. Ensure proper lighting and camera position.

**Q: Does it work on mobile/tablet?**
A: The UI is responsive, but accuracy is best on desktop with external webcam.

---

## Support

For additional help:
1. Check browser console for errors
2. Verify camera permissions in browser settings
3. Try different lighting conditions
4. Recalibrate multiple times
5. Test with different browser

Happy gaze controlling! 👁️✨
