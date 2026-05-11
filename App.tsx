import React from 'react';
import { View, Text } from 'react-native';
import { supabase } from './src/services/supabase/supabase';

// Keep supabase imported so the client is initialized at app start
void supabase;

export default function App() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Hello, World!</Text>
    </View>
  );
}
