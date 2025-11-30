import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Html } from '@react-three/drei';
import { useMemo, useState, useRef, useEffect } from 'react';
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
  // Position 0 (GO - corner at bottom-right)
  positions.push([boardSize/2 - cornerSize/2, 0, boardSize/2 - cornerSize/2]);

  // Positions 1-9 (regular spaces)
  for (let i = 1; i <= 9; i++) {
    positions.push([
      boardSize/2 - cornerSize - (i - 0.5) * regularSpaceSize,
      0,
      boardSize/2 - cornerSize/2
    ]);
  }

  // Position 10 (Jail - corner at bottom-left)
  positions.push([-boardSize/2 + cornerSize/2, 0, boardSize/2 - cornerSize/2]);

  // Left side (11-19): Bottom to top
  for (let i = 1; i <= 9; i++) {
    positions.push([
      -boardSize/2 + cornerSize/2,
      0,
      boardSize/2 - cornerSize - (i - 0.5) * regularSpaceSize
    ]);
  }

  // Position 20 (Free Parking - corner at top-left)
  positions.push([-boardSize/2 + cornerSize/2, 0, -boardSize/2 + cornerSize/2]);

  // Top row (21-29): Left to right
  for (let i = 1; i <= 9; i++) {
    positions.push([
      -boardSize/2 + cornerSize + (i - 0.5) * regularSpaceSize,
      0,
      -boardSize/2 + cornerSize/2
    ]);
  }

  // Position 30 (Go To Jail - corner at top-right)
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

function PropertySpace({ property, position }) {
  const [hovered, setHovered] = useState(false);
  const { players } = useGameStore();

  if (!property) return null;

  const color = PROPERTY_COLORS[property.color_group] || '#CCCCCC';
  const isOwned = property.owner_id !== null;
  const owner = isOwned ? players.find(p => p.id === property.owner_id) : null;
  const ownerColor = owner ? getPlayerColor(owner.turn_order).hex : null;

  // Determine rotation based on position for text
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
      {/* Property space base - now interactive */}
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
function SpecialSpace({ position, positionNumber }) {
  const [hovered, setHovered] = useState(false);

  // Define special space types and colors
  const getSpaceInfo = (pos) => {
    const specialSpaces = {
      0: { name: 'GO', color: '#E31E24', type: 'corner' },
      2: { name: 'Community Chest', color: '#87CEEB', type: 'special' },
      4: { name: 'Income Tax', color: '#CCCCCC', type: 'tax' },
      7: { name: 'Chance', color: '#FFA500', type: 'special' },
      10: { name: 'Jail', color: '#FFA500', type: 'corner' },
      17: { name: 'Community Chest', color: '#87CEEB', type: 'special' },
      20: { name: 'Free Parking', color: '#E31E24', type: 'corner' },
      22: { name: 'Chance', color: '#FFA500', type: 'special' },
      30: { name: 'Go To Jail', color: '#E31E24', type: 'corner' },
      33: { name: 'Community Chest', color: '#87CEEB', type: 'special' },
      36: { name: 'Chance', color: '#FFA500', type: 'special' },
      38: { name: 'Luxury Tax', color: '#CCCCCC', type: 'tax' },
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
      {/* Space base */}
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

function PlayerToken({ player, position, index, boardPositions }) {
  const meshRef = useRef();
  const [targetPos, setTargetPos] = useState(position);
  const [hovered, setHovered] = useState(false);
  const prevPlayerPosition = useRef(player.position);
  const initializedRef = useRef(false);

  const TOKEN_SHAPES = {
    car: { type: 'box', args: [0.7, 0.5, 1.1], color: '#E31E24' },
    hat: { type: 'cone', args: [0.5, 0.9, 8], color: '#1E90FF' },
    dog: { type: 'sphere', args: [0.5], color: '#8B4513' },
    ship: { type: 'cylinder', args: [0.4, 0.6, 1.1, 8], color: '#9370DB' },
    thimble: { type: 'cylinder', args: [0.3, 0.4, 0.7, 6], color: '#C0C0C0' }
  };

  const token = TOKEN_SHAPES[player.token_type] || TOKEN_SHAPES.car;

  // Offset multiple players on same space
  const offsetX = (index % 2) * 0.6 - 0.3;
  const offsetZ = Math.floor(index / 2) * 0.6 - 0.3;

  // Initialize mesh position on first render
  useEffect(() => {
    if (meshRef.current && !initializedRef.current) {
      meshRef.current.position.set(
        position[0] + offsetX,
        position[1] + 0.8,
        position[2] + offsetZ
      );
      initializedRef.current = true;
    }
  }, [position, offsetX, offsetZ]);

  // Update target position when player position changes
  useEffect(() => {
    if (prevPlayerPosition.current !== player.position) {
      const newBoardPos = boardPositions[player.position];
      if (newBoardPos) {
        setTargetPos(newBoardPos);
        prevPlayerPosition.current = player.position;
      }
    }
  }, [player.position, boardPositions]);

  // Animate movement
  useFrame(() => {
    if (meshRef.current && targetPos) {
      const current = meshRef.current.position;
      const target = new THREE.Vector3(
        targetPos[0] + offsetX,
        targetPos[1] + 0.8,
        targetPos[2] + offsetZ
      );

      // Smooth interpolation
      const speed = 0.05; // Adjust this to change animation speed (lower = slower)
      current.x += (target.x - current.x) * speed;
      current.y += (target.y - current.y) * speed;
      current.z += (target.z - current.z) * speed;

      // Add a slight bounce effect
      const distance = current.distanceTo(target);
      if (distance > 0.01) {
        meshRef.current.position.y += Math.sin(Date.now() * 0.01) * 0.05;
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

      {/* Hover label */}
      {hovered && meshRef.current && (
        <Html position={[
          meshRef.current.position.x,
          meshRef.current.position.y + 1.7,
          meshRef.current.position.z
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

        {/* Center area */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[24, 24]} />
          <meshStandardMaterial color="#1B5E20" />
        </mesh>

        {/* Monopoly logo text in center - laying flat */}
        <Text
          position={[0, 0.32, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={2.5}
          color="#D4AF37"
          anchorX="center"
          anchorY="middle"
        >
          MONOPOLY
        </Text>

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

        {/* Corner labels - larger and more visible */}
        <Text
          position={[15, 1.5, 16]}
          fontSize={1.2}
          color="#FFD700"
          anchorX="center"
          fontWeight="bold"
        >
          ← GO
        </Text>
        <Text
          position={[-15, 1.5, 16]}
          fontSize={1}
          color="#FFD700"
          anchorX="center"
        >
          JAIL
        </Text>
        <Text
          position={[-15, 1.5, -16]}
          fontSize={0.9}
          color="#FFD700"
          anchorX="center"
        >
          FREE PARKING
        </Text>
        <Text
          position={[15, 1.5, -16]}
          fontSize={0.9}
          color="#E31E24"
          anchorX="center"
        >
          GO TO JAIL
        </Text>

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
