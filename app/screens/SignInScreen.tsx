import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type SignInScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Main'
>;

type SignInScreenProps = {
  onSkip?: () => void;
  showSkip?: boolean;
  message?: string;
};

const SignInScreen: React.FC<SignInScreenProps> = ({
  onSkip,
  showSkip = false,
  message = 'Sign in to add and manage animals',
}) => {
  const { signInWithGoogle, signInWithApple } = useAuth();
  const navigation = useNavigation<SignInScreenNavigationProp>();
  const [loading, setLoading] = useState(false);
  const [signingInWith, setSigningInWith] = useState<'google' | 'apple' | null>(null);

  // Theme colors
  const THEME = {
    primary: '#D0F0C0',
    secondary: '#2E7D32',
    accent: '#388E3C',
    inactive: '#90A4AE',
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setSigningInWith('google');

      await signInWithGoogle();

      // Note: The actual sign-in completion happens through the auth state listener
      // in AuthContext, so we don't need to navigate here
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      Alert.alert(
        'Sign In Error',
        error.message || 'Failed to sign in with Google. Please try again.'
      );
    } finally {
      setLoading(false);
      setSigningInWith(null);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      setSigningInWith('apple');

      await signInWithApple();

      // Note: The actual sign-in completion happens through the auth state listener
    } catch (error: any) {
      console.error('Apple sign-in error:', error);
      Alert.alert(
        'Sign In Error',
        error.message || 'Failed to sign in with Apple. Please try again.'
      );
    } finally {
      setLoading(false);
      setSigningInWith(null);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* App Logo/Icon */}
        <View style={styles.logoContainer}>
          <Ionicons name="paw" size={80} color={THEME.secondary} />
          <Text style={styles.appName}>StraySync</Text>
          <Text style={styles.tagline}>Help animals in need</Text>
        </View>

        {/* Message */}
        <Text style={styles.message}>{message}</Text>

        {/* Sign In Buttons */}
        <View style={styles.buttonsContainer}>
          {/* Google Sign In */}
          <TouchableOpacity
            style={[
              styles.signInButton,
              styles.googleButton,
              loading && styles.disabledButton,
            ]}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            {signingInWith === 'google' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="logo-google" size={24} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Apple Sign In (iOS only) */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[
                styles.signInButton,
                styles.appleButton,
                loading && styles.disabledButton,
              ]}
              onPress={handleAppleSignIn}
              disabled={loading}
            >
              {signingInWith === 'apple' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={24} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>Continue with Apple</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Skip button (if allowed) */}
        {showSkip && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            disabled={loading}
          >
            <Text style={styles.skipButtonText}>Browse without signing in</Text>
          </TouchableOpacity>
        )}

        {/* Privacy notice */}
        <View style={styles.privacyContainer}>
          <Text style={styles.privacyText}>
            By signing in, you agree to our{' '}
            <Text
              style={styles.privacyLink}
              onPress={() => Linking.openURL('https://docs.google.com/document/d/1cU88q4LfuMV9RhJ1ArmMMfz33mZAGiLz-Q3xuQ1B99U/edit?usp=sharing')}
            >
              Privacy Policy
            </Text>
            . We respect your privacy and will never post without your permission.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginTop: 16,
  },
  tagline: {
    fontSize: 16,
    color: '#757575',
    marginTop: 8,
  },
  message: {
    fontSize: 18,
    color: '#424242',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  buttonsContainer: {
    width: '100%',
    maxWidth: 400,
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  googleButton: {
    backgroundColor: '#4285F4',
  },
  appleButton: {
    backgroundColor: '#000',
  },
  buttonIcon: {
    marginRight: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  skipButton: {
    marginTop: 24,
    paddingVertical: 12,
  },
  skipButtonText: {
    color: '#757575',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  privacyContainer: {
    marginTop: 32,
    maxWidth: 320,
  },
  privacyText: {
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'center',
    lineHeight: 18,
  },
  privacyLink: {
    color: '#2E7D32',
    textDecorationLine: 'underline',
  },
});

export default SignInScreen;
