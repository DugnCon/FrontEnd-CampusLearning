import React from 'react';
import Avatar from '../common/Avatar';

const IncomingCall = ({ callData, onAnswer, onReject }) => {
  if (!callData) return null;

  console.log('📞 INCOMING CALL - Rendering with data:', callData);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="text-center">
          <Avatar
            src={callData.initiatorPicture}
            alt={callData.initiatorName}
            size="xl"
            className="mx-auto mb-4"
          />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Incoming Call
          </h2>
          <p className="text-gray-600 mb-1">
            {callData.initiatorName} is calling you
          </p>
          <p className="text-gray-500 text-sm mb-6">
            {callData.type === 'video' ? 'Video Call' : 'Audio Call'}
          </p>
          
          <div className="flex justify-center space-x-4">
            <button
              onClick={onReject}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full flex items-center transition-colors"
            >
              <span>Decline</span>
            </button>
            <button
              onClick={onAnswer}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-full flex items-center transition-colors"
            >
              <span>Answer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCall;