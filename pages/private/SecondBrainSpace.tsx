import React from 'react';
import { User } from '../../types';
import { MemoryVault } from '../../components/brain/MemoryVault';
const SecondBrainSpace: React.FC<{ user: User | null }> = ({ user }) => (
  <MemoryVault key={user?._id || 'signed-out'} />
);
export default SecondBrainSpace;
