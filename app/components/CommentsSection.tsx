import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { commentService, Comment } from '../services/comments';
import { useAuth } from '../contexts/AuthContext';
import { COLORS } from '../styles/theme';

interface CommentsSectionProps {
  animalId: string;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({ animalId }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadComments();

    // Subscribe to real-time updates
    const channel = commentService.subscribeToComments(animalId, (newComment) => {
      setComments((prev) => [newComment, ...prev]);
    });

    return () => {
      commentService.unsubscribeFromComments(channel);
    };
  }, [animalId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const data = await commentService.getComments(animalId);
      setComments(data);
    } catch (error: any) {
      // Don't show error if table doesn't exist (migrations not run yet)
      if (!error.message?.includes('relation') && !error.message?.includes('does not exist')) {
        Alert.alert('Error', 'Failed to load comments');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to comment');
      return;
    }

    if (!commentText.trim()) {
      return;
    }

    if (commentText.length > 500) {
      Alert.alert('Error', 'Comment must be 500 characters or less');
      return;
    }

    try {
      setSubmitting(true);
      await commentService.addComment(animalId, commentText.trim());
      setCommentText('');
      // Reload to get the new comment with profile data
      await loadComments();
    } catch (error) {
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = (commentId: string) => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await commentService.deleteComment(commentId);
              setComments((prev) => prev.filter((c) => c.id !== commentId));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete comment');
            }
          },
        },
      ]
    );
  };

  const formatTimeAgo = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (seconds < 60) return 'just now';
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
      return date.toLocaleDateString();
    } catch (error) {
      return 'Unknown date';
    }
  };

  const renderComment = ({ item }: { item: Comment }) => {
    const isOwnComment = user?.id === item.auth_user_id;
    const displayName = item.profiles?.display_name || 'Anonymous';
    const avatarEmoji = item.profiles?.avatar_url || '🐾';

    return (
      <View style={styles.commentCard}>
        <View style={styles.commentHeader}>
          <View style={styles.commentAuthor}>
            <Text style={styles.avatarEmoji}>{avatarEmoji}</Text>
            <View>
              <Text style={styles.authorName}>{displayName}</Text>
              <Text style={styles.commentTime}>{formatTimeAgo(item.created_at)}</Text>
            </View>
          </View>
          {isOwnComment && (
            <TouchableOpacity
              onPress={() => handleDeleteComment(item.id)}
              style={styles.deleteButton}
            >
              <Ionicons name="trash-outline" size={18} color={COLORS.error} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.commentText}>{item.comment_text}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="chatbubbles-outline" size={20} color={COLORS.primaryDark} />
        <Text style={styles.headerTitle}>Comments ({comments.length})</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={COLORS.primaryDark} />
        </View>
      ) : comments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-outline" size={40} color={COLORS.textLight} />
          <Text style={styles.emptyText}>No comments yet</Text>
          <Text style={styles.emptySubtext}>
            {user ? 'Be the first to comment!' : 'Sign in to start the conversation'}
          </Text>
        </View>
      ) : (
        <View style={styles.commentsList}>
          {comments.map((item) => (
            <View key={item.id}>
              {renderComment({ item })}
            </View>
          ))}
        </View>
      )}

      {/* Comment Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={user ? 'Add a comment...' : 'Sign in to comment'}
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
          editable={!!user && !submitting}
          placeholderTextColor={COLORS.textLight}
        />
        <View style={styles.inputFooter}>
          <Text style={styles.charCount}>
            {commentText.length}/500
          </Text>
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!commentText.trim() || submitting || !user) && styles.sendButtonDisabled,
            ]}
            onPress={handleSubmitComment}
            disabled={!commentText.trim() || submitting || !user}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 4,
  },
  commentsList: {
    flex: 1,
    padding: 16,
    paddingBottom: 8,
  },
  commentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  commentAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  avatarEmoji: {
    fontSize: 32,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  commentTime: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  deleteButton: {
    padding: 4,
  },
  commentText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    color: COLORS.textPrimary,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  charCount: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  sendButton: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.inactiveButton,
  },
});
