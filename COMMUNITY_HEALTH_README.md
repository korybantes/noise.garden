# Community Health Features - Implementation Guide

This document explains how to use the new community health features implemented for Sprint 3 of your anonymous social app.

## 🚀 Features Implemented

### 1. Community Flags with Thresholds
- Users can flag posts for various reasons
- Posts are automatically quarantined after 3 flags
- Admins/moderators can review and manage flagged content

### 2. Popup Threads (Auto-close Caps)
- Create threads with reply limits and time limits
- Automatic closure when limits are reached
- Manual closure option for thread creators

### 3. Do-Not-Reply Posts
- Toggle to disable replies on posts
- Visual indicators for disabled replies
- Server-side enforcement

## 📁 New Files Created

- `api/community-health.mjs` - Backend API for community health features
- `src/components/PostFlag.tsx` - Post flagging modal
- `src/components/PopupThread.tsx` - Popup thread management
- `src/components/DoNotReplyToggle.tsx` - Reply toggle component
- `src/components/PostActions.tsx` - Comprehensive post actions

## 🗄️ Database Changes

New tables and columns added to support these features:

```sql
-- Flags table for post reporting
CREATE TABLE flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Popup threads table
CREATE TABLE popup_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  reply_limit INTEGER NOT NULL,
  time_limit_minutes INTEGER NOT NULL,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- New columns added to posts table
ALTER TABLE posts ADD COLUMN is_quarantined BOOLEAN DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN is_popup_thread BOOLEAN DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN popup_reply_limit INTEGER;
ALTER TABLE posts ADD COLUMN popup_time_limit INTEGER;
ALTER TABLE posts ADD COLUMN popup_closed_at TIMESTAMPTZ;
ALTER TABLE posts ADD COLUMN replies_disabled BOOLEAN DEFAULT FALSE;
```

**Note:** These database changes are automatically applied when your app starts up. The `initDatabase()` function in `src/lib/database.ts` will create the new tables and add the new columns to existing posts. No manual database migration is required.

## 🔧 How to Use

### Flagging Posts

1. **User Experience:**
   - Click the "Flag" button on any post (except your own)
   - Select a reason from predefined options or enter custom reason
   - Submit the flag

2. **Automatic Quarantine:**
   - Posts are automatically quarantined after 3 flags
   - Original poster is notified via notification system

3. **Admin Review:**
   - Admins/moderators see flagged posts in the Reports tab
   - Can quarantine/unquarantine posts manually
   - View flag counts and reasons

### Popup Threads

1. **Creating Popup Threads:**
   - Click "Make Popup Thread" on your own posts
   - Set reply limit (e.g., 10 replies)
   - Set time limit in minutes (e.g., 60 minutes)
   - Thread automatically closes when either limit is reached

2. **Thread Status:**
   - Shows remaining replies and time
   - Visual indicators for active/closed status
   - Manual close option available

3. **Automatic Closure:**
   - Reply limit reached: Thread closes automatically
   - Time limit reached: Thread closes automatically
   - Manual closure: Creator can close anytime

### Do-Not-Reply Posts

1. **Toggle Replies:**
   - Use the toggle button on your own posts
   - Visual lock/unlock indicators
   - Server-side enforcement prevents replies

2. **Visual Indicators:**
   - Lock icon when replies are disabled
   - Clear status message below post
   - Reply actions are hidden for disabled posts

## 🎯 Integration Examples

### In Your Post Component

```tsx
import { PostActions } from './PostActions';

function Post({ post }) {
  return (
    <div className="post">
      {/* Post content */}
      <div className="post-content">{post.content}</div>
      
      {/* Post actions including all new features */}
      <PostActions 
        post={post} 
        onPostUpdate={() => {
          // Refresh post data if needed
          refreshPost();
        }} 
      />
    </div>
  );
}
```

### In Your Feed Component

```tsx
import { PostActions } from './PostActions';

function Feed() {
  return (
    <div className="feed">
      {posts.map(post => (
        <div key={post.id} className="post">
          {/* Post content */}
          <PostActions post={post} />
        </div>
      ))}
    </div>
  );
}
```

## 🛡️ Admin Panel Features

### Reports Tab
- View all flagged posts
- See flag counts and reasons
- Quarantine/unquarantine posts
- Sort by flag count, date, etc.

### User Management
- Ban/unban users
- Change user roles
- View user statistics

### Quarantine Management
- Posts with 3+ flags are automatically quarantined
- Manual quarantine/unquarantine options
- Notification system for affected users

## 🔒 Security & Permissions

### User Permissions
- **Regular Users:** Can flag posts, create popup threads on own posts
- **Moderators:** Can quarantine posts, view reports, manage users
- **Admins:** Full access to all features

### Content Moderation
- Flag threshold: 3 flags = automatic quarantine
- Quarantined posts are hidden by default
- Original poster is notified of quarantine
- False reporting consequences (account restrictions)

## 🎨 UI Components

### PostFlag Component
- Modal with reason selection
- Custom reason input for "Other"
- Warning about false reports
- Success/error feedback

### PopupThread Component
- Create popup thread form
- Real-time status display
- Manual close controls
- Visual indicators for limits

### DoNotReplyToggle Component
- Toggle button with icons
- Loading states
- Visual feedback
- Server synchronization

## 🚀 API Endpoints

### Community Health API (`/api/community-health`)

- `flagPost` - Flag a post
- `getPostFlags` - Get flags for a post
- `getFlaggedPosts` - Get all flagged posts (admin/moderator)
- `quarantinePost` - Quarantine a post (admin/moderator)
- `unquarantinePost` - Unquarantine a post (admin/moderator)
- `createPopupThread` - Create a popup thread
- `closePopupThread` - Close a popup thread
- `checkPopupThreadStatus` - Check thread status

### App API (`/api/app`)

- `updatePostRepliesDisabled` - Toggle replies on/off

## 🔄 State Management

### Local State Updates
- Components update local state immediately
- API calls for server synchronization
- Callback functions for parent component updates

### Real-time Features
- Popup thread status updates
- Flag count changes
- Quarantine status changes

## 🧪 Testing

### Manual Testing
1. Create a post and test flagging
2. Test popup thread creation and limits
3. Test do-not-reply toggle
4. Test admin quarantine actions

### Edge Cases
- Multiple flags from same user
- Flag threshold boundary conditions
- Popup thread time calculations
- Permission checks

## 🚨 Troubleshooting

### Common Issues
1. **Flags not working:** Check user authentication and permissions
2. **Popup threads not closing:** Verify time calculations and database updates
3. **Quarantine not working:** Check admin/moderator role permissions
4. **UI not updating:** Verify callback functions and state management

### Debug Steps
1. Check browser console for errors
2. Verify API responses
3. Check database state
4. Verify user permissions

## 📈 Future Enhancements

### Potential Improvements
- Flag reason analytics
- Automated content review
- Appeal system for quarantined posts
- Advanced popup thread features
- Bulk moderation actions

### Performance Optimizations
- Pagination for flagged posts
- Caching for thread status
- Real-time updates via WebSocket
- Optimized database queries

## 🎉 Conclusion

These community health features provide a robust foundation for content moderation and community management. The implementation follows best practices for security, user experience, and maintainability.

For questions or issues, refer to the code comments and API documentation in the respective files. 