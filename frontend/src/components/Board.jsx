import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Text, Html, useGLTF } from '@react-three/drei';
import { useMemo, useState, useRef, useEffect, Suspense } from 'react';
import useGameStore from '../store/gameStore';
import { getPlayerColor } from '../utils/playerColors';
import * as THREE from 'three';

// Calculate all 40 board positions around the perimeter with proper corner spacing
function calculateBoardPositions() {
  const positions = [];
  const boardSize = 30;
  const cornerSize = 3.5; // Square corners (3.5 x 3.5)
  const regularSpaceSize = (boardSize - 2 * cornerSize) / 9; // Calculate space size to fit perfectly

  // Bottom row (0-10): Right to left
  // Position 0 (New Year's Eve - corner at bottom-right)
  positions.push([boardSize/2 - cornerSize/2, 0, boardSize/2 - cornerSize/2]);

  // Positions 1-9 (regular spaces)
  for (let i = 1; i <= 9; i++) {
    positions.push([
      boardSize/2 - cornerSize - (i - 0.5) * regularSpaceSize,
      0,
      boardSize/2 - cornerSize/2
    ]);
  }

  // Position 10 (Rikers - corner at bottom-left)
  positions.push([-boardSize/2 + cornerSize/2, 0, boardSize/2 - cornerSize/2]);

  // Left side (11-19): Bottom to top
  for (let i = 1; i <= 9; i++) {
    positions.push([
      -boardSize/2 + cornerSize/2,
      0,
      boardSize/2 - cornerSize - (i - 0.5) * regularSpaceSize
    ]);
  }

  // Position 20 (Lost and Found - corner at top-left)
  positions.push([-boardSize/2 + cornerSize/2, 0, -boardSize/2 + cornerSize/2]);

  // Top row (21-29): Left to right
  for (let i = 1; i <= 9; i++) {
    positions.push([
      -boardSize/2 + cornerSize + (i - 0.5) * regularSpaceSize,
      0,
      -boardSize/2 + cornerSize/2
    ]);
  }

  // Position 30 (Arrested by NYPD - corner at top-right)
  positions.push([boardSize/2 - cornerSize/2, 0, -boardSize/2 + cornerSize/2]);

  // Right side (31-39): Top to bottom
  for (let i = 1; i <= 9; i++) {
    positions.push([
      boardSize/2 - cornerSize/2,
      0,
      -boardSize/2 + cornerSize + (i - 0.5) * regularSpaceSize
    ]);
  }

  return positions;
}

const PROPERTY_COLORS = {
  brown: '#8B4513',
  lightblue: '#87CEEB',
  pink: '#FF1493',
  orange: '#FFA500',
  red: '#FF0000',
  yellow: '#FFFF00',
  green: '#008000',
  darkblue: '#00008B',
  railroad: '#000000',
  utility: '#FFFFFF'
};

// Helper function to get texture path for a property/space
function getTexturePath(name) {
  // Convert property name to filename format (lowercase, no spaces/apostrophes)
  const filename = name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/\s+/g, '')
    .replace(/&/g, 'and');

  return `/board/${filename}.png`;
}

// Component for the center board texture
function CenterBoard() {
  const boardTexture = useLoader(THREE.TextureLoader, '/board/board.png');

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
      <planeGeometry args={[24, 24]} />
      <meshStandardMaterial
        map={boardTexture}
        transparent={true}
      />
    </mesh>
  );
}

// Component for the logo in the center of the board
function CenterLogo() {
  const texture = useLoader(THREE.TextureLoader, '/polymono-logo.png');

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.33, 0]}>
      <planeGeometry args={[8, 8]} />
      <meshStandardMaterial
        map={texture}
        transparent={true}
        emissive="#FFFFFF"
        emissiveIntensity={0.2}
      />
    </mesh>
  );
}

// Textured property component that loads texture
function TexturedProperty({ property, position, hovered, setHovered, ownerColor }) {
  const texture = useLoader(THREE.TextureLoader, getTexturePath(property.name));

  const getRotation = () => {
    const pos = property.position_on_board;
    if (pos >= 0 && pos <= 10) return [0, 0, 0];
    if (pos >= 11 && pos <= 19) return [0, -Math.PI / 2, 0];
    if (pos >= 20 && pos <= 30) return [0, Math.PI, 0];
    return [0, Math.PI / 2, 0];
  };

  const isOwned = property.owner_id !== null;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, getRotation()[1]]}
      position={[0, 0.31, 0]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <planeGeometry args={[2.2, 2.2]} />
      <meshStandardMaterial
        map={texture}
        transparent={true}
        emissive={hovered ? '#FFFFFF' : (isOwned ? ownerColor : '#000000')}
        emissiveIntensity={hovered ? 0.3 : (isOwned ? 0.2 : 0)}
      />
    </mesh>
  );
}

function PropertySpace({ property, position }) {
  const [hovered, setHovered] = useState(false);
  const { players } = useGameStore();

  if (!property) return null;

  const color = PROPERTY_COLORS[property.color_group] || '#CCCCCC';
  const isOwned = property.owner_id !== null;
  const owner = isOwned ? players.find(p => p.id === property.owner_id) : null;
  const ownerColor = owner ? getPlayerColor(owner.turn_order).hex : null;

  // Check if texture should exist for this property (database uses property_type field)
  const hasTexture = property.property_type === 'property' || property.property_type === 'railroad' || property.property_type === 'utility';

  // Determine rotation based on position for text and texture
  const getRotation = () => {
    const pos = property.position_on_board;
    if (pos >= 0 && pos <= 10) return [0, 0, 0]; // Bottom - text faces outward (south)
    if (pos >= 11 && pos <= 19) return [0, -Math.PI / 2, 0]; // Left - text faces outward (west)
    if (pos >= 20 && pos <= 30) return [0, Math.PI, 0]; // Top - text faces outward (north)
    return [0, Math.PI / 2, 0]; // Right - text faces outward (east)
  };

  // Determine color bar position and rotation based on board position
  const getColorBarTransform = () => {
    const pos = property.position_on_board;
    if (pos >= 0 && pos <= 10) {
      // Bottom row: bar at bottom (facing outward/south)
      return { position: [0, 0.31, 0.85], rotation: [0, 0, 0], size: [2.2, 0.3, 0.5] };
    }
    if (pos >= 11 && pos <= 19) {
      // Left side: bar at left (facing outward/west)
      return { position: [-0.85, 0.31, 0], rotation: [0, Math.PI / 2, 0], size: [2.2, 0.3, 0.5] };
    }
    if (pos >= 20 && pos <= 30) {
      // Top row: bar at top (facing outward/north)
      return { position: [0, 0.31, -0.85], rotation: [0, 0, 0], size: [2.2, 0.3, 0.5] };
    }
    // Right side: bar at right (facing outward/east)
    return { position: [0.85, 0.31, 0], rotation: [0, Math.PI / 2, 0], size: [2.2, 0.3, 0.5] };
  };

  const formatPrice = (price) => {
    if (!price) return '';
    return `$${price.toLocaleString()}`;
  };

  return (
    <group position={position}>
      {hasTexture ? (
        // Use textured plane if texture should exist
        <TexturedProperty
          property={property}
          position={position}
          hovered={hovered}
          setHovered={setHovered}
          ownerColor={ownerColor}
        />
      ) : (
        // Fallback to original rendering for non-property spaces
        <>
          <mesh
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
          >
            <boxGeometry args={[2.2, 0.3, 2.2]} />
            <meshStandardMaterial
              color={hovered ? '#FFFFFF' : (isOwned ? ownerColor : '#EFEFEF')}
              emissive={hovered ? '#666666' : '#000000'}
              emissiveIntensity={hovered ? 0.3 : 0}
            />
          </mesh>

          {/* Color strip for properties */}
          {property.color_group && (() => {
            const barTransform = getColorBarTransform();
            return (
              <mesh position={barTransform.position} rotation={barTransform.rotation}>
                <boxGeometry args={barTransform.size} />
                <meshStandardMaterial color={color} />
              </mesh>
            );
          })()}

          {/* Property name */}
          <Text
            position={[0, 0.32, 0]}
            rotation={[-Math.PI / 2, 0, getRotation()[1]]}
            fontSize={0.25}
            color="#1a1a1a"
            anchorX="center"
            anchorY="middle"
            maxWidth={2}
            textAlign="center"
          >
            {property.name}
          </Text>

          {/* Price */}
          {property.price && (() => {
            const pos = property.position_on_board;
            let pricePosition;
            if (pos >= 0 && pos <= 10) {
              pricePosition = [0, 0.32, -0.6]; // Bottom row: price near center
            } else if (pos >= 11 && pos <= 19) {
              pricePosition = [0.6, 0.32, 0]; // Left side: price near center
            } else if (pos >= 20 && pos <= 30) {
              pricePosition = [0, 0.32, 0.6]; // Top row: price near center
            } else {
              pricePosition = [-0.6, 0.32, 0]; // Right side: price near center
            }
            return (
              <Text
                position={pricePosition}
                rotation={[-Math.PI / 2, 0, getRotation()[1]]}
                fontSize={0.2}
                color="#1B5E20"
                anchorX="center"
                anchorY="middle"
                fontWeight="bold"
              >
                {formatPrice(property.price)}
              </Text>
            );
          })()}
        </>
      )}

      {/* Hover info card */}
      {hovered && (
        <Html
          position={[0, 3, 0]}
          center
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <div style={{
            background: 'linear-gradient(135deg, #1E5742 0%, #0A3D2C 100%)',
            border: '3px solid #D4AF37',
            borderRadius: '12px',
            padding: '1rem',
            minWidth: '250px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            color: 'white',
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif',
          }}>
            <div style={{
              borderBottom: property.color_group ? `4px solid ${color}` : 'none',
              paddingBottom: '0.5rem',
              marginBottom: '0.5rem',
            }}>
              <div style={{
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#D4AF37',
                marginBottom: '0.25rem'
              }}>
                {property.name}
              </div>
              {property.color_group && (
                <div style={{
                  fontSize: '11px',
                  color: '#9DBFAE',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {property.color_group} property
                </div>
              )}
            </div>

            <div style={{ marginBottom: '0.5rem' }}>
              {/* Price */}
              {property.purchase_price && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ color: '#D0E9DC' }}>Price:</span>
                  <span style={{ fontWeight: 'bold', color: '#FFD700' }}>{formatPrice(property.purchase_price)}</span>
                </div>
              )}

              {/* Rent Information */}
              {property.rent_base !== undefined && property.rent_values && Array.isArray(property.rent_values) && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#9DBFAE',
                    marginBottom: '0.25rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {property.property_type === 'railroad' ? 'Rent (by number owned):' :
                     property.property_type === 'utility' ? 'Rent (multiplier × dice):' :
                     'Rent:'}
                  </div>

                  {property.property_type === 'railroad' ? (
                    // Railroad rent: 1 RR, 2 RRs, 3 RRs, 4 RRs
                    property.rent_values.slice(0, 4).map((rent, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', paddingLeft: '0.5rem' }}>
                        <span style={{ color: '#D0E9DC', fontSize: '12px' }}>
                          {idx + 1} Railroad{idx > 0 ? 's' : ''}:
                        </span>
                        <span>{formatPrice(rent)}</span>
                      </div>
                    ))
                  ) : property.property_type === 'utility' ? (
                    // Utility rent: 4x or 10x
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', paddingLeft: '0.5rem' }}>
                        <span style={{ color: '#D0E9DC', fontSize: '12px' }}>1 Utility:</span>
                        <span>{property.rent_values[0]}× dice</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', paddingLeft: '0.5rem' }}>
                        <span style={{ color: '#D0E9DC', fontSize: '12px' }}>Both Utilities:</span>
                        <span>{property.rent_values[1]}× dice</span>
                      </div>
                    </>
                  ) : (
                    // Property rent: Base, With Set, 1-4 Houses, Hotel
                    // rent_values array format: [base, with_set, 1H, 2H, 3H, 4H, hotel]
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', paddingLeft: '0.5rem' }}>
                        <span style={{ color: '#D0E9DC', fontSize: '12px' }}>Base:</span>
                        <span style={{ fontWeight: 'bold' }}>{formatPrice(property.rent_base)}</span>
                      </div>
                      {property.rent_values.length > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', paddingLeft: '0.5rem' }}>
                          <span style={{ color: '#D0E9DC', fontSize: '12px' }}>With Set:</span>
                          <span>{formatPrice(property.rent_values[1])}</span>
                        </div>
                      )}
                      {property.rent_values.slice(2, 7).map((rent, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', paddingLeft: '0.5rem' }}>
                          <span style={{ color: '#D0E9DC', fontSize: '12px' }}>
                            {idx < 4 ? `${idx + 1} House${idx > 0 ? 's' : ''}:` : 'Hotel:'}
                          </span>
                          <span>{formatPrice(rent)}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Mortgage Value */}
              {property.mortgage_value && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ color: '#D0E9DC' }}>Mortgage:</span>
                  <span>{formatPrice(property.mortgage_value)}</span>
                </div>
              )}

              {/* House Cost */}
              {property.house_cost && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ color: '#D0E9DC' }}>House Cost:</span>
                  <span>{formatPrice(property.house_cost)}</span>
                </div>
              )}
            </div>

            {/* Owner Info */}
            <div style={{
              marginTop: '0.5rem',
              paddingTop: '0.5rem',
              borderTop: '1px solid rgba(255,255,255,0.2)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ color: '#D0E9DC' }}>Owner:</span>
                <span style={{ fontWeight: 'bold', color: isOwned ? '#FFD700' : '#999' }}>
                  {isOwned && owner ? owner.username : 'Available'}
                </span>
              </div>

              {/* Houses/Hotel or Number Owned */}
              {property.property_type === 'railroad' || property.property_type === 'utility' ? (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#D0E9DC' }}>Number Owned:</span>
                  <span style={{ fontWeight: 'bold', color: '#999' }}>
                    {/* This will be updated dynamically based on how many RR/utilities the owner has */}
                    --
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#D0E9DC' }}>Development:</span>
                  <span style={{ fontWeight: 'bold', color: property.house_count > 0 ? '#4CAF50' : '#999' }}>
                    {property.house_count === 5 ? '🏨 Hotel' : property.house_count > 0 ? `🏠 ${property.house_count} House${property.house_count > 1 ? 's' : ''}` : 'None'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </Html>
      )}

      {/* Houses (small green cubes) */}
      {property.house_count > 0 && property.house_count < 5 && (
        <>
          {Array.from({ length: property.house_count }).map((_, i) => (
            <mesh key={i} position={[-0.8 + i * 0.4, 0.5, -0.3]}>
              <boxGeometry args={[0.35, 0.35, 0.35]} />
              <meshStandardMaterial color="green" />
            </mesh>
          ))}
        </>
      )}

      {/* Hotel (red cube) */}
      {property.house_count === 5 && (
        <mesh position={[0, 0.7, -0.3]}>
          <boxGeometry args={[0.7, 0.7, 0.7]} />
          <meshStandardMaterial color="red" />
        </mesh>
      )}
    </group>
  );
}

// Component for special spaces (corners, chance, community chest, tax, etc.)
// Textured special space component
function TexturedSpecialSpace({ spaceInfo, positionNumber, hovered, setHovered }) {
  const texture = useLoader(THREE.TextureLoader, getTexturePath(spaceInfo.name));

  const getRotation = () => {
    if (positionNumber >= 0 && positionNumber <= 10) return [0, 0, 0];
    if (positionNumber >= 11 && positionNumber <= 19) return [0, -Math.PI / 2, 0];
    if (positionNumber >= 20 && positionNumber <= 30) return [0, Math.PI, 0];
    return [0, Math.PI / 2, 0];
  };

  const isCorner = spaceInfo.type === 'corner';

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, getRotation()[1]]}
      position={[0, 0.31, 0]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <planeGeometry args={isCorner ? [3.5, 3.5] : [2.2, 2.2]} />
      <meshStandardMaterial
        map={texture}
        transparent={true}
        emissive={hovered ? '#FFFFFF' : '#000000'}
        emissiveIntensity={hovered ? 0.3 : 0}
      />
    </mesh>
  );
}

function SpecialSpace({ position, positionNumber }) {
  const [hovered, setHovered] = useState(false);

  // Define special space types and colors
  const getSpaceInfo = (pos) => {
    const specialSpaces = {
      0: { name: "New Year's Eve", color: '#E31E24', type: 'corner' },
      2: { name: 'Community Fund', color: '#87CEEB', type: 'special' },
      4: { name: 'City Income Tax', color: '#CCCCCC', type: 'tax' },
      7: { name: 'Opportunity', color: '#FFA500', type: 'special' },
      10: { name: 'Rikers', color: '#FFA500', type: 'corner' },
      17: { name: 'Community Fund', color: '#87CEEB', type: 'special' },
      20: { name: 'Lost and Found', color: '#E31E24', type: 'corner' },
      22: { name: 'Opportunity', color: '#FFA500', type: 'special' },
      30: { name: 'Arrested by NYPD', color: '#E31E24', type: 'corner' },
      33: { name: 'Community Fund', color: '#87CEEB', type: 'special' },
      36: { name: 'Opportunity', color: '#FFA500', type: 'special' },
      38: { name: 'Penthouse Luxury Tax', color: '#CCCCCC', type: 'tax' },
    };
    return specialSpaces[pos] || null;
  };

  const spaceInfo = getSpaceInfo(positionNumber);
  if (!spaceInfo) return null;

  const getRotation = () => {
    if (positionNumber >= 0 && positionNumber <= 10) return [0, 0, 0]; // Bottom - text faces outward (south)
    if (positionNumber >= 11 && positionNumber <= 19) return [0, -Math.PI / 2, 0]; // Left - text faces outward (west)
    if (positionNumber >= 20 && positionNumber <= 30) return [0, Math.PI, 0]; // Top - text faces outward (north)
    return [0, Math.PI / 2, 0]; // Right - text faces outward (east)
  };

  const isCorner = spaceInfo.type === 'corner';

  return (
    <group position={position}>
      <TexturedSpecialSpace
        spaceInfo={spaceInfo}
        positionNumber={positionNumber}
        hovered={hovered}
        setHovered={setHovered}
      />
      {/* Fallback rendering is removed since we always have textures for special spaces */}
      {false && (
        <>
          <mesh
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
          >
            <boxGeometry args={isCorner ? [3.5, 0.3, 3.5] : [2.2, 0.3, 2.2]} />
            <meshStandardMaterial
              color={hovered ? '#FFFFFF' : spaceInfo.color}
              emissive={hovered ? '#666666' : '#000000'}
              emissiveIntensity={hovered ? 0.3 : 0}
            />
          </mesh>

          {/* Space name */}
          <Text
            position={[0, 0.32, 0]}
            rotation={[-Math.PI / 2, 0, getRotation()[1]]}
            fontSize={isCorner ? 0.35 : 0.22}
            color="#FFFFFF"
            anchorX="center"
            anchorY="middle"
            maxWidth={2}
            textAlign="center"
          >
            {spaceInfo.name}
          </Text>
        </>
      )}

      {/* Hover info */}
      {hovered && (
        <Html
          position={[0, 3, 0]}
          center
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <div style={{
            background: 'linear-gradient(135deg, #1E5742 0%, #0A3D2C 100%)',
            border: `3px solid ${spaceInfo.color}`,
            borderRadius: '12px',
            padding: '1rem',
            minWidth: '200px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            color: 'white',
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif',
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: spaceInfo.color,
              textAlign: 'center'
            }}>
              {spaceInfo.name}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#9DBFAE',
              textAlign: 'center',
              marginTop: '0.5rem'
            }}>
              {spaceInfo.type === 'corner' && 'Corner Space'}
              {spaceInfo.type === 'special' && 'Special Card'}
              {spaceInfo.type === 'tax' && 'Tax Space'}
            </div>
            {spaceInfo.type === 'tax' && (
              <div style={{
                marginTop: '0.75rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid rgba(255,255,255,0.2)',
                textAlign: 'center'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#D0E9DC' }}>Tax Amount:</span>
                  <span style={{ fontWeight: 'bold', color: '#FFD700', fontSize: '15px' }}>
                    {positionNumber === 4 ? '$200' : '$100'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

// Component for 3D model tokens (GLB files)
function ModelToken({ modelPath, position, scale = 0.5, rotation = [0, 0, 0] }) {
  const { scene } = useGLTF(modelPath);
  const clonedScene = useMemo(() => {
    const clone = scene.clone();

    // Apply gold color to all materials in the model
    clone.traverse((child) => {
      if (child.isMesh) {
        // Clone material to avoid affecting the original
        child.material = child.material.clone();
        // Set gold color
        child.material.color.set('#D4AF37');
        // Add metallic gold effect
        child.material.metalness = 0.7;
        child.material.roughness = 0.3;
      }
    });

    return clone;
  }, [scene]);

  return (
    <primitive
      object={clonedScene}
      position={position}
      scale={scale}
      rotation={rotation}
    />
  );
}

function PlayerToken({ player, position, index, boardPositions }) {
  const meshRef = useRef();
  const groupRef = useRef();
  const [targetPos, setTargetPos] = useState(position);
  const [targetRotation, setTargetRotation] = useState(0);
  const [hovered, setHovered] = useState(false);
  const prevPlayerPosition = useRef(player.position);
  const initializedRef = useRef(false);

  // Gold color for all pieces
  const GOLD_COLOR = '#D4AF37';

  // Define which tokens use 3D models vs geometric shapes
  const TOKEN_MODELS = {
    taxi: { model: '/tokens/taxi.glb', scale: 0.6, baseRotation: [0, -Math.PI / 2, 0], color: GOLD_COLOR },
    pigeon: { model: '/tokens/pigeon.glb', scale: 0.6, baseRotation: [0, -Math.PI / 2, 0], color: GOLD_COLOR },
    empire: { model: '/tokens/empire.glb', scale: 0.6, baseRotation: [0, -Math.PI / 2, 0], color: GOLD_COLOR },
    subway: { model: '/tokens/subway.glb', scale: 0.6, baseRotation: [0, -Math.PI / 2, 0], color: GOLD_COLOR },
    bull: { model: '/tokens/bull.glb', scale: 0.6, baseRotation: [0, -Math.PI / 2, 0], color: GOLD_COLOR },
    rat: { model: '/tokens/rat.glb', scale: 0.6, baseRotation: [0, -Math.PI / 2, 0], color: GOLD_COLOR }
  };

  const TOKEN_SHAPES = {
    car: { type: 'box', args: [0.7, 0.5, 1.1], color: GOLD_COLOR },
    hat: { type: 'cone', args: [0.5, 0.9, 8], color: GOLD_COLOR },
    dog: { type: 'sphere', args: [0.5], color: GOLD_COLOR },
    ship: { type: 'cylinder', args: [0.4, 0.6, 1.1, 8], color: GOLD_COLOR },
    thimble: { type: 'cylinder', args: [0.3, 0.4, 0.7, 6], color: GOLD_COLOR }
  };

  const isModelToken = TOKEN_MODELS[player.token_type];
  const token = isModelToken || TOKEN_SHAPES[player.token_type] || TOKEN_SHAPES.car;

  // Calculate rotation based on board position
  const getRotationForPosition = (pos) => {
    if (pos >= 0 && pos <= 10) return 0; // Bottom - facing right
    if (pos >= 11 && pos <= 20) return -Math.PI / 2; // Left - facing up
    if (pos >= 21 && pos <= 30) return Math.PI; // Top - facing left
    return Math.PI / 2; // Right - facing down
  };

  // Offset multiple players on same space
  const offsetX = (index % 2) * 0.6 - 0.3;
  const offsetZ = Math.floor(index / 2) * 0.6 - 0.3;

  // Initialize position and rotation on first render
  useEffect(() => {
    const ref = isModelToken ? groupRef : meshRef;
    if (ref.current && !initializedRef.current) {
      ref.current.position.set(
        position[0] + offsetX,
        position[1] + 0.8,
        position[2] + offsetZ
      );
      const initialRotation = getRotationForPosition(player.position);
      setTargetRotation(initialRotation);
      if (isModelToken) {
        ref.current.rotation.y = isModelToken.baseRotation[1] + initialRotation;
      }
      initializedRef.current = true;
    }
  }, [position, offsetX, offsetZ, isModelToken, player.position]);

  // Update target position and rotation when player position changes
  useEffect(() => {
    if (prevPlayerPosition.current !== player.position) {
      const newBoardPos = boardPositions[player.position];
      if (newBoardPos) {
        setTargetPos(newBoardPos);

        // Calculate new rotation based on position
        const newRotation = getRotationForPosition(player.position);
        setTargetRotation(newRotation);

        prevPlayerPosition.current = player.position;
      }
    }
  }, [player.position, boardPositions]);

  // Animate movement and rotation
  useFrame(() => {
    const ref = isModelToken ? groupRef : meshRef;
    if (ref.current && targetPos) {
      const current = ref.current.position;
      const target = new THREE.Vector3(
        targetPos[0] + offsetX,
        targetPos[1] + 0.8,
        targetPos[2] + offsetZ
      );

      // Smooth interpolation for position
      const speed = 0.05; // Adjust this to change animation speed (lower = slower)
      current.x += (target.x - current.x) * speed;
      current.y += (target.y - current.y) * speed;
      current.z += (target.z - current.z) * speed;

      // Smooth interpolation for rotation (only for 3D models)
      if (isModelToken) {
        const targetRot = isModelToken.baseRotation[1] + targetRotation;
        const currentRot = ref.current.rotation.y;

        // Handle wrapping around -PI to PI
        let rotDiff = targetRot - currentRot;
        if (rotDiff > Math.PI) rotDiff -= 2 * Math.PI;
        if (rotDiff < -Math.PI) rotDiff += 2 * Math.PI;

        ref.current.rotation.y += rotDiff * speed;
      }

      // Add a slight bounce effect
      const distance = current.distanceTo(target);
      if (distance > 0.01) {
        ref.current.position.y += Math.sin(Date.now() * 0.01) * 0.05;
      }
    }
  });

  const GeometryComponent = () => {
    switch (token.type) {
      case 'box':
        return <boxGeometry args={token.args} />;
      case 'cone':
        return <coneGeometry args={token.args} />;
      case 'sphere':
        return <sphereGeometry args={token.args} />;
      case 'cylinder':
        return <cylinderGeometry args={token.args} />;
      default:
        return <boxGeometry args={[0.6, 0.6, 0.6]} />;
    }
  };

  return (
    <group>
      {isModelToken ? (
        // Render 3D model token
        <group
          ref={groupRef}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <ModelToken
            modelPath={isModelToken.model}
            position={[0, 0, 0]}
            scale={isModelToken.scale}
            rotation={[isModelToken.baseRotation[0], 0, isModelToken.baseRotation[2]]}
          />
        </group>
      ) : (
        // Render geometric shape token
        <mesh
          ref={meshRef}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <GeometryComponent />
          <meshStandardMaterial
            color={token.color}
            metalness={0.4}
            roughness={0.6}
            emissive={hovered ? token.color : '#000000'}
            emissiveIntensity={hovered ? 0.5 : 0}
          />
        </mesh>
      )}

      {/* Hover label */}
      {hovered && ((isModelToken && groupRef.current) || (!isModelToken && meshRef.current)) && (
        <Html position={[
          (isModelToken ? groupRef.current : meshRef.current).position.x,
          (isModelToken ? groupRef.current : meshRef.current).position.y + 1.7,
          (isModelToken ? groupRef.current : meshRef.current).position.z
        ]} center>
          <div style={{
            background: 'linear-gradient(135deg, #1E5742 0%, #0A3D2C 100%)',
            border: '2px solid #D4AF37',
            borderRadius: '8px',
            padding: '0.5rem 0.75rem',
            minWidth: '120px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            color: 'white',
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif',
            textAlign: 'center',
            pointerEvents: 'none',
            userSelect: 'none',
          }}>
            <div style={{
              fontWeight: 'bold',
              color: '#D4AF37',
              marginBottom: '0.25rem',
            }}>
              {player.username}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#9DBFAE',
              textTransform: 'capitalize',
            }}>
              {player.token_type}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#FFD700',
              fontWeight: 'bold',
              marginTop: '0.25rem',
            }}>
              ${player.money.toLocaleString()}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// Loading fallback component for Suspense
function LoadingFallback() {
  return (
    <Html center>
      <div style={{
        background: 'linear-gradient(135deg, #1E5742 0%, #0A3D2C 100%)',
        border: '3px solid #D4AF37',
        borderRadius: '16px',
        padding: '2rem 3rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        color: 'white',
        textAlign: 'center',
        minWidth: '300px',
      }}>
        <div style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          color: '#D4AF37',
          marginBottom: '1rem',
        }}>
          Loading PolyMono Board...
        </div>
        <div style={{
          fontSize: '1rem',
          color: '#9DBFAE',
        }}>
          Please wait while we load the Manhattan Edition
        </div>
        <div style={{
          marginTop: '1.5rem',
          fontSize: '2rem',
        }}>
          🗽
        </div>
      </div>
    </Html>
  );
}

const Board = () => {
  const { properties, players } = useGameStore();
  const boardPositions = useMemo(() => calculateBoardPositions(), []);

  // Group players by position for proper offsetting
  const playersByPosition = useMemo(() => {
    const grouped = {};
    players.forEach(player => {
      if (!grouped[player.position]) {
        grouped[player.position] = [];
      }
      grouped[player.position].push(player);
    });
    return grouped;
  }, [players]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas camera={{ position: [0, 50, 50], fov: 50 }}>
        <ambientLight intensity={0.7} />
        <pointLight position={[30, 30, 30]} intensity={1.2} />
        <pointLight position={[-30, 30, -30]} intensity={0.8} />
        <directionalLight position={[0, 50, 0]} intensity={0.5} />

        {/* Board base */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
          <planeGeometry args={[36, 36]} />
          <meshStandardMaterial color="#0A3D2C" />
        </mesh>

        {/* Main board content with loading fallback */}
        <Suspense fallback={<LoadingFallback />}>
          {/* Center board background */}
          <CenterBoard />

        {/* Render all 40 board spaces */}
        {Array.from({ length: 40 }).map((_, index) => {
          const position = boardPositions[index];
          if (!position) return null;

          // Check if this position has a property
          const property = properties.find(p => p.position_on_board === index);

          if (property) {
            // Render property space
            return (
              <PropertySpace
                key={`property-${index}`}
                property={property}
                position={position}
              />
            );
          } else {
            // Render special space (corners, chance, community chest, tax)
            return (
              <SpecialSpace
                key={`special-${index}`}
                position={position}
                positionNumber={index}
              />
            );
          }
        })}

        {/* Render player tokens */}
        {Object.entries(playersByPosition).map(([pos, playersAtPos]) => {
          const position = boardPositions[parseInt(pos)];
          if (position) {
            return playersAtPos.map((player, idx) => (
              <PlayerToken
                key={player.id}
                player={player}
                position={position}
                index={idx}
                boardPositions={boardPositions}
              />
            ));
          }
          return null;
        })}
        </Suspense>

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={30}
          maxDistance={80}
        />
      </Canvas>
    </div>
  );
};

export default Board;
