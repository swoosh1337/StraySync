import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Dimensions,
  Image,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import PagerView from 'react-native-pager-view';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { PetALogCollection, createSticker, AnimalSticker as AnimalStickerType, createCollectionPage } from '../types/petalog';
import { petalogService } from '../services/petalogService';
import AnimalSticker from '../components/AnimalSticker';
import DottedBackground from '../components/DottedBackground';
import { CANVAS_CONSTANTS } from '../types/petalog';
import { backgroundRemovalService } from '../services/backgroundRemoval';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const PetALogScreen: React.FC = () => {
  const [collection, setCollection] = useState<PetALogCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSticker, setSelectedSticker] = useState<AnimalStickerType | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [stickerName, setStickerName] = useState('');
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const pagerRef = useRef<PagerView>(null);

  // Load collection on mount
  useEffect(() => {
    loadCollection();
  }, []);

  const loadCollection = async () => {
    try {
      setLoading(true);
      const data = await petalogService.loadCollection();
      setCollection(data);
    } catch (error) {
      console.error('[PetALog] Error loading collection:', error);
      Alert.alert('Error', 'Failed to load your collection');
    } finally {
      setLoading(false);
    }
  };

  const cropAndAddImage = async (imageUri: string) => {
    try {
      // Open crop editor
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Show cropping interface
      setImageToCrop(result.uri);
      setCropModalVisible(true);
    } catch (error) {
      console.error('[PetALog] Error preparing crop:', error);
      // If cropping fails, just add the original image
      await addImageToCollection(imageUri);
    }
  };

  const addImageToCollection = async (imageUri: string) => {
    try {
      setProcessingImage(true);

      // Try to remove background (with error handling)
      let finalImageUri = imageUri;
      let bgRemoved = false;

      try {
        const bgRemovalResult = await backgroundRemovalService.removeBackground(imageUri);

        if (bgRemovalResult && bgRemovalResult.success) {
          finalImageUri = bgRemovalResult.imageUri;
          bgRemoved = true;
          if (__DEV__) {
            console.log('[PetALog] Background removed successfully');
          }
        }
      } catch (bgError) {
        // Silently fail background removal and use original image
        console.error('[PetALog] Background removal error:', bgError);
        if (__DEV__) {
          console.log('[PetALog] Using original image due to error');
        }
      }

      // Add photo at center of canvas
      const centerX = SCREEN_WIDTH / 2 - CANVAS_CONSTANTS.STICKER_SIZE / 2; // Half of sticker width
      const centerY = SCREEN_HEIGHT / 2 - CANVAS_CONSTANTS.STICKER_SIZE / 2; // Half of sticker height

      const newSticker = createSticker(
        finalImageUri,
        { x: centerX, y: centerY },
        'cat' // TODO: Detect animal type
      );

      if (collection) {
        const updatedCollection = await petalogService.addSticker(
          collection,
          newSticker
        );
        setCollection(updatedCollection);

        const message = bgRemoved
          ? '✨ Background removed! Tap to name it, or drag to move.'
          : 'Photo added! Tap to name it, or drag to move.';

        Alert.alert('Success', message);
      }
    } catch (error) {
      console.error('[PetALog] Error adding to collection:', error);
      Alert.alert('Error', 'Failed to add photo. Please try again.');
    } finally {
      setProcessingImage(false);
    }
  };

  const handleCropComplete = async () => {
    if (imageToCrop) {
      await addImageToCollection(imageToCrop);
      setCropModalVisible(false);
      setImageToCrop(null);
    }
  };

  const handleAddPhoto = async () => {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        // Respect user's decision - don't show alert asking to reconsider
        console.log('[PetALog] Camera permission denied by user');
        return;
      }

      // Launch camera with editing enabled
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await addImageToCollection(result.assets[0].uri);
      }
    } catch (error) {
      console.error('[PetALog] Error adding photo:', error);
      Alert.alert('Error', 'Failed to add photo');
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        // Respect user's decision - don't show alert asking to reconsider
        console.log('[PetALog] Photo library permission denied by user');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await addImageToCollection(result.assets[0].uri);
      }
    } catch (error) {
      console.error('[PetALog] Error picking photo:', error);
      Alert.alert('Error', 'Failed to add photo');
    }
  };

  const handleAddPhotoOptions = () => {
    Alert.alert(
      'Add Photo',
      'Choose a method',
      [
        { text: 'Take Photo', onPress: handleAddPhoto },
        { text: 'Choose from Gallery', onPress: handlePickFromGallery },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleStickerTap = (sticker: AnimalStickerType) => {
    setSelectedSticker(sticker);
    setStickerName(sticker.name);
    setEditModalVisible(true);
  };

  const handleStickerUpdate = async (stickerId: string, updates: Partial<AnimalStickerType>) => {
    if (collection) {
      const updatedCollection = await petalogService.updateSticker(
        collection,
        stickerId,
        updates
      );
      setCollection(updatedCollection);
    }
  };

  const handleSaveStickerName = async () => {
    if (selectedSticker && collection) {
      await handleStickerUpdate(selectedSticker.id, { name: stickerName });
      setEditModalVisible(false);
      setSelectedSticker(null);
      setStickerName('');
    }
  };

  const handleDeleteSticker = async () => {
    if (selectedSticker && collection) {
      Alert.alert(
        'Delete Sticker',
        'Are you sure you want to remove this sticker?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const updatedCollection = await petalogService.deleteSticker(
                collection,
                selectedSticker.id
              );
              setCollection(updatedCollection);
              setEditModalVisible(false);
              setSelectedSticker(null);
            },
          },
        ]
      );
    }
  };

  const handlePageChange = async (pageIndex: number) => {
    if (collection) {
      const updatedCollection = await petalogService.setCurrentPage(
        collection,
        pageIndex
      );
      setCollection(updatedCollection);
    }
  };

  const handleAddNewPage = async () => {
    if (collection) {
      Alert.prompt(
        'New Page',
        'Enter a name for your new collection page',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Create',
            onPress: async (pageName) => {
              if (pageName && pageName.trim()) {
                const newPage = createCollectionPage(pageName.trim());
                const updatedCollection = await petalogService.addPage(
                  collection,
                  newPage
                );
                setCollection(updatedCollection);
                // Switch to the new page
                const newPageIndex = updatedCollection.pages.length - 1;
                pagerRef.current?.setPage(newPageIndex);
              }
            },
          },
        ],
        'plain-text',
        '',
        'default'
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading your collection...</Text>
      </View>
    );
  }

  if (!collection) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#FF5722" />
        <Text style={styles.errorText}>Failed to load collection</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadCollection}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {collection.pages[collection.currentPageIndex].name}
          </Text>
          <View style={styles.headerRight}>
            <Text style={styles.headerSubtitle}>
              {collection.pages[collection.currentPageIndex].stickers.length} stickers
            </Text>
            <TouchableOpacity
              style={styles.addPageButton}
              onPress={handleAddNewPage}
            >
              <Ionicons name="add-circle-outline" size={24} color="#2E7D32" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Swipeable Pages */}
        <PagerView
          ref={pagerRef}
          style={styles.pagerView}
          initialPage={collection.currentPageIndex}
          onPageSelected={(e) => handlePageChange(e.nativeEvent.position)}
        >
          {collection.pages.map((page, pageIndex) => (
            <View
              key={page.id}
              style={styles.canvas}
            >
              {/* Dotted background pattern */}
              <DottedBackground
                backgroundColor={page.backgroundColor}
                dotColor="#BDBDBD"
                dotSize={1.5}
                dotSpacing={20}
              />

              {page.stickers.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="images-outline" size={64} color="#BDBDBD" />
                  <Text style={styles.emptyText}>This page is empty</Text>
                  <Text style={styles.emptySubtext}>
                    {pageIndex === collection.currentPageIndex
                      ? "Tap the + button to add your first animal photo!"
                      : "Swipe here and tap + to add photos"}
                  </Text>
                </View>
              ) : (
                <>
                  {/* Render all stickers for this page */}
                  {page.stickers.map((sticker) => (
                    <AnimalSticker
                      key={sticker.id}
                      sticker={sticker}
                      onUpdate={(updates) => handleStickerUpdate(sticker.id, updates)}
                      onTap={() => handleStickerTap(sticker)}
                    />
                  ))}
                </>
              )}
            </View>
          ))}
        </PagerView>

        {/* Floating Action Button */}
        <TouchableOpacity
          style={styles.fab}
          onPress={handleAddPhotoOptions}
          activeOpacity={0.8}
          disabled={processingImage}
        >
          {processingImage ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <Ionicons name="add" size={32} color="#fff" />
          )}
        </TouchableOpacity>

        {/* Processing Overlay */}
        {processingImage && (
          <View style={styles.processingOverlay}>
            <View style={styles.processingCard}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.processingText}>🪄 Removing background...</Text>
              <Text style={styles.processingSubtext}>This may take a few seconds</Text>
            </View>
          </View>
        )}

        {/* Page Indicator */}
        <View style={styles.pageIndicator}>
          {collection.pages.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => pagerRef.current?.setPage(index)}
              style={[
                styles.pageIndicatorDot,
                index === collection.currentPageIndex && styles.pageIndicatorDotActive,
              ]}
            />
          ))}
        </View>

        {/* Edit Sticker Modal */}
        <Modal
          visible={editModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setEditModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Sticker</Text>

              <TextInput
                style={styles.modalInput}
                value={stickerName}
                onChangeText={setStickerName}
                placeholder="Enter animal name"
                autoFocus={true}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.deleteButton]}
                  onPress={handleDeleteSticker}
                  activeOpacity={0.85}
                >
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                  <Text style={styles.modalButtonText}>Delete</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setEditModalVisible(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalButtonTextDark}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleSaveStickerName}
                  activeOpacity={0.9}
                >
                  <Text style={styles.modalButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#FF5722',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#757575',
  },
  addPageButton: {
    padding: 4,
  },
  pagerView: {
    flex: 1,
  },
  canvas: {
    flex: 1,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#757575',
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  canvasContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4CAF50',
  },
  placeholderSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#757575',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  pageIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#BDBDBD',
  },
  pageIndicatorDotActive: {
    backgroundColor: '#4CAF50',
    width: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  // Keep existing rectangular button style used across app
  modalButton: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteButton: {
    backgroundColor: '#E53935',
  },
  cancelButton: {
    backgroundColor: '#F1F1F1',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalButtonTextDark: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  processingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    minWidth: 250,
  },
  processingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    textAlign: 'center',
  },
  processingSubtext: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
  },
});

export default PetALogScreen;
