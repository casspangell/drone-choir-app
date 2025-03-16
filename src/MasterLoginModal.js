import React, { useState } from 'react';

const MASTER_PASSWORD = 'droneChoir2024!'; // Store this securely in environment variable ideally

const MasterLoginModal = ({ 
  isOpen, 
  onClose, 
  onMasterGranted 
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (password === MASTER_PASSWORD) {
      // Clear any previous errors
      setError('');
      
      // Call the callback to grant master status
      onMasterGranted();
      
      // Close the modal
      onClose();
    } else {
      // Set error message for incorrect password
      setError('Incorrect password. Please try again.');
      
      // Optional: Clear password field
      setPassword('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto outline-none focus:outline-none">
      <div className="relative w-auto max-w-sm mx-auto my-6">
        <div className="relative flex flex-col w-full bg-white border-0 rounded-lg shadow-lg outline-none focus:outline-none">
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-solid rounded-t border-blueGray-200">
            <h3 className="text-2xl font-semibold">
              Master Control Login
            </h3>
            <button
              className="float-right p-1 ml-auto text-3xl font-semibold leading-none text-black bg-transparent border-0 outline-none opacity-5 focus:outline-none"
              onClick={onClose}
            >
              ×
            </button>
          </div>
          
          {/* Body */}
          <div className="relative flex-auto p-6">
            <p className="mb-4 text-sm text-gray-600">
              Enter the master control password to access advanced features.
            </p>
            
            <input 
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            {error && (
              <p className="mt-2 text-sm text-red-500">
                {error}
              </p>
            )}
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-end p-6 border-t border-solid rounded-b border-blueGray-200">
            <button
              className="px-6 py-2 mb-1 mr-1 text-sm font-bold text-gray-600 uppercase transition-all duration-150 ease-linear outline-none background-transparent focus:outline-none"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className={`px-6 py-2 mb-1 mr-1 text-sm font-bold text-white uppercase transition-all duration-150 ease-linear rounded shadow outline-none ${
                !password 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700 focus:outline-none'
              }`}
              type="button"
              onClick={handleSubmit}
              disabled={!password}
            >
              Submit
            </button>
          </div>
        </div>
      </div>
      
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black opacity-25"></div>
    </div>
  );
};

export default MasterLoginModal;