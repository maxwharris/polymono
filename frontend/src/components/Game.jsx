import { useEffect, useRef, useState } from 'react';
import Board from './Board';
import Chat from './Chat';
import Trade from './Trade';
import useGameStore from '../store/gameStore';
import { getPlayerColor } from '../utils/playerColors';

// Property Tooltip Component
const PropertyTooltip = ({ property, visible, position, myPlayer, allProperties, onBuyHouses }) => {
  if (!visible || !property) return null;

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

  const color = PROPERTY_COLORS[property.color_group] || '#CCCCCC';
  const formatPrice = (price) => price ? `$${price.toLocaleString()}` : '';

  // Handle rent_values - it might be a string (from DB) or already an array
  let rentValues = [];
  try {
    if (property.rent_values) {
      rentValues = typeof property.rent_values === 'string'
        ? JSON.parse(property.rent_values)
        : property.rent_values;
    }
  } catch (error) {
    console.error('Error parsing rent_values:', error);
    rentValues = [];
  }

  // Check if player can build houses
  let canBuild = false;
  let buildOptions = [];

  if (myPlayer && allProperties && property.property_type === 'property' && property.owner_id === myPlayer.id) {
    // Player owns this property - check if they can build
    const colorGroupProperties = allProperties.filter(
      p => p.color_group === property.color_group && p.property_type === 'property'
    );
    const ownsAll = colorGroupProperties.every(p => p.owner_id === myPlayer.id);
    const anyMortgaged = colorGroupProperties.some(p => p.is_mortgaged);
    const houseCounts = colorGroupProperties.map(p => p.house_count || 0);
    const minHouses = Math.min(...houseCounts);

    canBuild = ownsAll &&
               !anyMortgaged &&
               !property.is_mortgaged &&
               property.house_count < 5 &&
               property.house_count <= minHouses;

    if (canBuild && property.house_cost) {
      // Calculate how many houses can be built
      const maxBuildable = Math.min(
        5 - (property.house_count || 0),
        Math.floor(myPlayer.money / property.house_cost)
      );

      // Respect even building rule
      const maxBeforeUneven = (property.house_count || 0) <= minHouses ? 1 : 0;
      const actualMax = Math.min(maxBuildable, maxBeforeUneven);

      if (actualMax > 0) {
        for (let i = 1; i <= actualMax; i++) {
          const cost = property.house_cost * i;
          const newCount = (property.house_count || 0) + i;
          buildOptions.push({
            count: i,
            cost,
            label: newCount === 5 ? '🏨 Hotel' : `🏠 ${i} House${i > 1 ? 's' : ''}`
          });
        }
      }
    }
  }

  return (
    <div style={{
      position: 'fixed',
      left: `${position.x}px`,
      top: `${position.y}px`,
      background: 'linear-gradient(135deg, #1E5742 0%, #0A3D2C 100%)',
      border: '3px solid #D4AF37',
      borderRadius: '12px',
      padding: '1rem',
      minWidth: '250px',
      maxWidth: '300px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
      color: 'white',
      fontSize: '14px',
      fontFamily: 'Inter, sans-serif',
      zIndex: 10000,
      pointerEvents: 'none',
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
            {property.color_group.replace('lightblue', 'light blue').replace('darkblue', 'dark blue')} property
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
        {property.rent_base !== undefined && rentValues.length > 0 && (
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
              rentValues.slice(0, 4).map((rent, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', paddingLeft: '0.5rem' }}>
                  <span style={{ color: '#D0E9DC', fontSize: '12px' }}>
                    {idx + 1} Railroad{idx > 0 ? 's' : ''}:
                  </span>
                  <span>{formatPrice(rent)}</span>
                </div>
              ))
            ) : property.property_type === 'utility' ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', paddingLeft: '0.5rem' }}>
                  <span style={{ color: '#D0E9DC', fontSize: '12px' }}>1 Utility:</span>
                  <span>{rentValues[0]}× dice</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', paddingLeft: '0.5rem' }}>
                  <span style={{ color: '#D0E9DC', fontSize: '12px' }}>Both Utilities:</span>
                  <span>{rentValues[1]}× dice</span>
                </div>
              </>
            ) : (
              // rent_values array format: [base, with_set, 1H, 2H, 3H, 4H, hotel]
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', paddingLeft: '0.5rem' }}>
                  <span style={{ color: '#D0E9DC', fontSize: '12px' }}>Base:</span>
                  <span style={{ fontWeight: 'bold' }}>{formatPrice(property.rent_base)}</span>
                </div>
                {rentValues.length > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', paddingLeft: '0.5rem' }}>
                    <span style={{ color: '#D0E9DC', fontSize: '12px' }}>With Set:</span>
                    <span>{formatPrice(rentValues[1])}</span>
                  </div>
                )}
                {rentValues.slice(2, 7).map((rent, idx) => (
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

      {/* Current Development */}
      <div style={{
        marginTop: '0.5rem',
        paddingTop: '0.5rem',
        borderTop: '1px solid rgba(255,255,255,0.2)',
      }}>
        {property.property_type === 'railroad' || property.property_type === 'utility' ? (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#D0E9DC' }}>Number Owned:</span>
            <span style={{ fontWeight: 'bold', color: '#999' }}>--</span>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#D0E9DC' }}>Development:</span>
            <span style={{ fontWeight: 'bold', color: property.house_count > 0 ? '#4CAF50' : '#999' }}>
              {property.house_count === 5 ? '🏨 Hotel' : property.house_count > 0 ? `🏠 ${property.house_count} House${property.house_count > 1 ? 's' : ''}` : 'None'}
            </span>
          </div>
        )}
        {property.is_mortgaged && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
            <span style={{ color: '#D0E9DC' }}>Status:</span>
            <span style={{ fontWeight: 'bold', color: '#FFA500' }}>Mortgaged 💤</span>
          </div>
        )}
      </div>

      {/* Build Houses/Hotel Section */}
      {buildOptions.length > 0 && (
        <div style={{
          marginTop: '0.5rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid rgba(255,255,255,0.2)',
        }}>
          <div style={{
            color: '#4CAF50',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            fontSize: '13px'
          }}>
            🏗️ Build Options
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {buildOptions.map((option, idx) => (
              <button
                key={idx}
                onClick={() => onBuyHouses(property.id, option.count)}
                style={{
                  pointerEvents: 'auto',
                  background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
                  border: '1px solid #45a049',
                  borderRadius: '4px',
                  color: 'white',
                  padding: '0.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(76, 175, 80, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <span>{option.label}</span>
                <span style={{
                  background: 'rgba(255,255,255,0.2)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '3px'
                }}>
                  {formatPrice(option.cost)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Game = () => {
  const {
    user,
    logout,
    game,
    players,
    myPlayer,
    isMyTurn,
    currentDiceRoll,
    canRollAgain,
    gameLog,
    properties,
    landedSpace,
    purchasedProperty,
    drawnCard,
    isSpectator,
    joinGame,
    rollDice,
    buyProperty,
    buyHouses,
    endTurn
  } = useGameStore();

  // Get current turn player
  const currentTurnPlayer = players.find(p => p.user_id === game?.current_turn_user_id);

  const hasJoinedRef = useRef(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [showLandedPopup, setShowLandedPopup] = useState(false);
  const [showPurchasePopup, setShowPurchasePopup] = useState(false);
  const [showCardPopup, setShowCardPopup] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [hoveredProperty, setHoveredProperty] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Auto-join game when component mounts (only once) - skip if spectator
    if (!hasJoinedRef.current && user && !isSpectator) {
      hasJoinedRef.current = true;
      joinGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show popup when landedSpace changes
  useEffect(() => {
    if (landedSpace) {
      setShowLandedPopup(true);
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setShowLandedPopup(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [landedSpace]);

  // Show popup when property is purchased
  useEffect(() => {
    if (purchasedProperty) {
      setShowPurchasePopup(true);
      // Auto-hide after 4 seconds
      const timer = setTimeout(() => {
        setShowPurchasePopup(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [purchasedProperty]);

  // Show popup when card is drawn
  useEffect(() => {
    if (drawnCard) {
      setShowCardPopup(true);
      // Auto-hide after 6 seconds
      const timer = setTimeout(() => {
        setShowCardPopup(false);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [drawnCard]);

  const handleRollDice = async () => {
    try {
      await rollDice();
    } catch (error) {
      console.error('Failed to roll dice:', error);
    }
  };

  const handleBuyProperty = async () => {
    if (!myPlayer) return;
    try {
      // Get property at current position
      const currentProperty = properties.find(
        p => p.position_on_board === myPlayer.position
      );
      if (currentProperty) {
        await buyProperty(currentProperty.id);
      }
    } catch (error) {
      console.error('Failed to buy property:', error);
    }
  };

  // Check if current property can be purchased
  const currentProperty = myPlayer ? properties.find(
    p => p.position_on_board === myPlayer.position
  ) : null;

  const canBuyCurrentProperty = currentProperty &&
    currentProperty.property_type !== 'special' &&
    currentProperty.owner_id === null &&
    !currentProperty.is_mortgaged;

  const handleEndTurn = async () => {
    try {
      await endTurn();
    } catch (error) {
      console.error('Failed to end turn:', error);
    }
  };

  const handleBuyHouses = async (propertyId, count) => {
    try {
      await buyHouses(propertyId, count);
      // Success message will be shown via socket event
    } catch (error) {
      console.error('Failed to buy houses:', error);
      alert(error.message || 'Failed to buy houses');
    }
  };

  return (
    <div style={styles.container}>
      {/* Property Tooltip */}
      <PropertyTooltip
        property={hoveredProperty}
        visible={hoveredProperty !== null}
        position={tooltipPosition}
        myPlayer={myPlayer}
        allProperties={properties}
        onBuyHouses={handleBuyHouses}
      />

      {/* Trade Modal */}
      <Trade isOpen={showTradeModal} onClose={() => setShowTradeModal(false)} />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.headerTitle}>MONOPOLY</h1>
          <span style={styles.headerSubtitle}>Live Game</span>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.userInfo}>
            <span style={styles.username}>
              {isSpectator ? '👁 Spectator' : user?.username}
            </span>
            {myPlayer && !isSpectator && (
              <div style={styles.moneyBadge}>
                <span style={styles.moneyIcon}>💰</span>
                <span style={styles.moneyAmount}>${myPlayer.money.toLocaleString()}</span>
              </div>
            )}
          </div>
          {/* Show whose turn it is */}
          {currentTurnPlayer && (() => {
            const turnPlayerColor = getPlayerColor(currentTurnPlayer.turn_order);
            return (
              <div style={{
                ...styles.turnIndicator,
                ...(isMyTurn ? {} : {
                  ...styles.turnIndicatorOther,
                  borderColor: turnPlayerColor.hex,
                  boxShadow: `0 0 15px ${turnPlayerColor.hex}40`
                })
              }} className={isMyTurn ? "pulse" : ""}>
                {!isMyTurn && (
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: turnPlayerColor.hex,
                    display: 'inline-block',
                    marginRight: '0.5rem',
                    boxShadow: `0 0 8px ${turnPlayerColor.hex}`
                  }} />
                )}
                {isMyTurn ? '⭐ YOUR TURN' : `${currentTurnPlayer.username}'s Turn`}
              </div>
            );
          })()}
          <button onClick={logout} className="outline" style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </header>

      {/* Main content */}
      <div style={styles.mainContent}>
        {/* Sidebar */}
        <aside style={styles.sidebar}>
          {/* Players Section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>
              <span style={styles.sectionIcon}>👥</span>
              Players
            </h2>
            <div style={styles.playersList}>
              {players.map((player) => {
                const playerColor = getPlayerColor(player.turn_order);
                return (
                <div
                  key={player.id}
                  style={{
                    ...styles.playerCard,
                    ...(player.user_id === user.id ? styles.playerCardActive : {}),
                    ...(player.is_bankrupt ? styles.playerCardBankrupt : {}),
                    cursor: 'pointer',
                    borderLeft: `4px solid ${playerColor.hex}`
                  }}
                  className="fade-in"
                  onClick={() => setSelectedPlayerId(selectedPlayerId === player.id ? null : player.id)}
                >
                  <div style={styles.playerHeader}>
                    <div style={{
                      ...styles.playerColorDot,
                      backgroundColor: playerColor.hex
                    }} />
                    <span style={styles.playerToken}>{getTokenEmoji(player.token_type)}</span>
                    <div style={styles.playerInfo}>
                      <div style={styles.playerName}>{player.username}</div>
                      <div style={styles.playerRole}>{player.token_type}</div>
                    </div>
                  </div>
                  <div style={styles.playerMoney}>${player.money.toLocaleString()}</div>
                  {player.is_in_jail && (
                    <div style={styles.jailBadge}>🔒 In Jail</div>
                  )}
                  {player.get_out_of_jail_cards > 0 && (
                    <div style={styles.jailCardBadge}>🎴 Jail Card ×{player.get_out_of_jail_cards}</div>
                  )}
                  {player.is_bankrupt && (
                    <div style={styles.bankruptBadge}>💔 BANKRUPT</div>
                  )}

                  {/* Player Properties - Show when selected */}
                  {selectedPlayerId === player.id && (
                    <div style={styles.propertiesSection}>
                      <div style={styles.propertiesHeader}>
                        🏠 Properties ({properties.filter(p => p.owner_id === player.id).length})
                      </div>
                      <div style={styles.propertiesList}>
                        {properties
                          .filter(p => p.owner_id === player.id)
                          .map(property => {
                            // Get property color
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
                            const propertyColor = PROPERTY_COLORS[property.color_group] || null;

                            return (
                              <div
                                key={property.id}
                                style={{
                                  ...styles.propertyItem,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => {
                                  setHoveredProperty(property);
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setTooltipPosition({
                                    x: rect.right + 10,
                                    y: rect.top
                                  });
                                }}
                                onMouseLeave={() => setHoveredProperty(null)}
                              >
                                {/* Color indicator */}
                                {propertyColor && (
                                  <div style={{
                                    width: '4px',
                                    height: '100%',
                                    minHeight: '40px',
                                    background: propertyColor,
                                    borderRadius: '2px',
                                    flexShrink: 0
                                  }} />
                                )}
                                <div style={{ flex: 1 }}>
                                  <div style={styles.propertyName}>{property.name}</div>
                                  <div style={styles.propertyDetails}>
                                    {property.color_group && (
                                      <span style={{
                                        color: '#9DBFAE',
                                        fontSize: '0.7rem',
                                        textTransform: 'capitalize',
                                        marginRight: '0.5rem'
                                      }}>
                                        {property.color_group.replace('lightblue', 'light blue').replace('darkblue', 'dark blue')}
                                      </span>
                                    )}
                                    <span style={styles.propertyPrice}>${property.purchase_price}</span>
                                    {property.house_count > 0 && (
                                      <span style={styles.propertyHouses}>
                                        {property.house_count === 5 ? '🏨' : `${'🏠'.repeat(property.house_count)}`}
                                      </span>
                                    )}
                                    {property.is_mortgaged && (
                                      <span style={styles.mortgagedBadge}>💤</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        {properties.filter(p => p.owner_id === player.id).length === 0 && (
                          <div style={styles.noProperties}>No properties owned</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          </div>

          {/* Actions Section - Hidden for spectators */}
          {!isSpectator && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>🎮</span>
                Actions
              </h2>
              <div style={styles.actionButtons}>
                <button
                  onClick={handleRollDice}
                  disabled={!isMyTurn || !canRollAgain}
                  style={styles.actionButton}
                  title={!canRollAgain ? "Already rolled this turn" : ""}
                >
                  <span style={styles.actionIcon}>🎲</span>
                  Roll Dice
                </button>

                <button
                  onClick={handleBuyProperty}
                  disabled={!isMyTurn || !canBuyCurrentProperty}
                  className="secondary"
                  style={styles.actionButton}
                  title={!canBuyCurrentProperty ? "Property not available for purchase" : ""}
                >
                  <span style={styles.actionIcon}>🏠</span>
                  Buy Property
                </button>

                <button
                  onClick={handleEndTurn}
                  disabled={!isMyTurn}
                  className="outline"
                  style={styles.actionButton}
                >
                  <span style={styles.actionIcon}>⏭</span>
                  End Turn
                </button>

                <button
                  onClick={() => setShowTradeModal(true)}
                  style={styles.tradeButton}
                >
                  <span style={styles.actionIcon}>🤝</span>
                  Trade
                </button>
              </div>
            </div>
          )}

          {/* Dice Display */}
          {currentDiceRoll && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>🎲</span>
                Last Roll
              </h3>
              <div style={styles.diceDisplay} className="fade-in">
                <div style={styles.diceContainer}>
                  <div style={styles.die}>{currentDiceRoll.die1}</div>
                  <div style={styles.die}>{currentDiceRoll.die2}</div>
                </div>
                <div style={styles.diceTotal}>Total: {currentDiceRoll.total}</div>
                {currentDiceRoll.isDoubles && (
                  <div style={styles.doublesIndicator}>⚡ DOUBLES!</div>
                )}
              </div>
            </div>
          )}

          {/* Game Log */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <span style={styles.sectionIcon}>📜</span>
              Game Log
            </h3>
            <div style={styles.gameLog}>
              {gameLog.slice(-10).reverse().map((log, idx) => (
                <div key={idx} style={styles.logEntry} className="slide-in">
                  {log.message}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* 3D Board */}
        <main style={styles.boardContainer}>
          <Board />
        </main>
      </div>

      {/* Chat */}
      <Chat />

      {/* Landed Space Popup */}
      {showLandedPopup && landedSpace && (
        <div style={styles.popupOverlay} onClick={() => setShowLandedPopup(false)}>
          <div style={styles.popup} className="fade-in" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowLandedPopup(false)}
              style={styles.closeButton}
            >
              ✕
            </button>
            <div style={styles.popupHeader}>
              <span style={styles.popupIcon}>📍</span>
              <h2 style={styles.popupTitle}>You Landed On</h2>
            </div>
            {landedSpace.property ? (
              <div style={styles.popupContent}>
                <div style={styles.popupPropertyName}>{landedSpace.property.name}</div>
                {landedSpace.property.color_group && (
                  <div style={styles.popupPropertyType}>
                    {landedSpace.property.color_group} Property
                  </div>
                )}
                <div style={styles.popupDetails}>
                  {landedSpace.property.purchase_price && (
                    <div style={styles.popupDetailRow}>
                      <span>Price:</span>
                      <span style={styles.popupDetailValue}>${landedSpace.property.purchase_price.toLocaleString()}</span>
                    </div>
                  )}
                  {landedSpace.property.rent_base !== undefined && (
                    <div style={styles.popupDetailRow}>
                      <span>Rent:</span>
                      <span style={styles.popupDetailValue}>${landedSpace.property.rent_base.toLocaleString()}</span>
                    </div>
                  )}
                  {landedSpace.property.owner_id && (
                    <div style={styles.popupDetailRow}>
                      <span>Owner:</span>
                      <span style={styles.popupDetailValue}>
                        {players.find(p => p.id === landedSpace.property.owner_id)?.username || 'Unknown'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={styles.popupContent}>
                <div style={styles.popupPropertyName}>{getSpecialSpaceName(landedSpace.position)}</div>
                <div style={styles.popupPropertyType}>Special Space</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Property Purchased Popup */}
      {showPurchasePopup && purchasedProperty && (
        <div style={styles.popupOverlay} onClick={() => setShowPurchasePopup(false)}>
          <div style={styles.popup} className="fade-in" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowPurchasePopup(false)}
              style={styles.closeButton}
            >
              ✕
            </button>
            <div style={styles.popupHeader}>
              <span style={styles.popupIcon}>🏠</span>
              <h2 style={styles.popupTitle}>Property Purchased!</h2>
            </div>
            <div style={styles.popupContent}>
              <div style={styles.popupPropertyName}>{purchasedProperty.property.name}</div>
              <div style={styles.popupPropertyType}>
                Purchased by {purchasedProperty.player.username}
              </div>
              <div style={styles.popupDetails}>
                <div style={styles.popupDetailRow}>
                  <span>Price Paid:</span>
                  <span style={styles.popupDetailValue}>${purchasedProperty.property.purchase_price?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Card Drawn Popup (Chance/Community Chest) */}
      {showCardPopup && drawnCard && (
        <div style={styles.popupOverlay} onClick={() => setShowCardPopup(false)}>
          <div style={{
            ...styles.popup,
            borderColor: drawnCard.deckType === 'chance' ? '#FFA500' : '#87CEEB',
            boxShadow: `0 10px 40px rgba(0,0,0,0.5), 0 0 20px ${drawnCard.deckType === 'chance' ? 'rgba(255,165,0,0.3)' : 'rgba(135,206,235,0.3)'}`
          }} className="fade-in" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowCardPopup(false)}
              style={styles.closeButton}
            >
              ✕
            </button>
            <div style={styles.popupHeader}>
              <span style={styles.popupIcon}>
                {drawnCard.deckType === 'chance' ? '🎲' : '🎁'}
              </span>
              <h2 style={{
                ...styles.popupTitle,
                color: drawnCard.deckType === 'chance' ? '#FFA500' : '#87CEEB'
              }}>
                {drawnCard.deckType === 'chance' ? 'CHANCE' : 'COMMUNITY CHEST'}
              </h2>
            </div>
            <div style={styles.popupContent}>
              <div style={styles.cardDrawnBy}>
                Drawn by: {drawnCard.player.username}
              </div>
              <div style={styles.cardText}>
                {drawnCard.card.text}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function getSpecialSpaceName(position) {
  const specialSpaces = {
    0: 'GO - Collect $200',
    2: 'Community Chest',
    4: 'Income Tax',
    7: 'Chance',
    10: 'Just Visiting Jail',
    17: 'Community Chest',
    20: 'Free Parking',
    22: 'Chance',
    30: 'Go To Jail',
    33: 'Community Chest',
    36: 'Chance',
    38: 'Luxury Tax',
  };
  return specialSpaces[position] || `Space ${position}`;
}

function getTokenEmoji(tokenType) {
  const tokens = {
    car: '🚗',
    hat: '🎩',
    dog: '🐕',
    ship: '🚢',
    thimble: '🎲',
  };
  return tokens[tokenType] || '🎮';
}

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary)',
  },
  header: {
    background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-card) 100%)',
    padding: '0.75rem 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '2px solid var(--monopoly-gold)',
    boxShadow: 'var(--shadow-lg)',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '1rem',
  },
  headerTitle: {
    fontSize: '1.75rem',
    margin: 0,
    background: 'linear-gradient(135deg, var(--monopoly-gold) 0%, var(--monopoly-dark-gold) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  headerSubtitle: {
    color: 'var(--monopoly-red)',
    fontSize: '0.9rem',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  username: {
    color: 'var(--text-primary)',
    fontWeight: '600',
  },
  moneyBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'linear-gradient(135deg, var(--monopoly-green) 0%, var(--monopoly-dark-green) 100%)',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
  },
  moneyIcon: {
    fontSize: '1.25rem',
  },
  moneyAmount: {
    color: 'white',
    fontWeight: '700',
    fontSize: '1.1rem',
  },
  turnIndicator: {
    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
    color: '#1a1a1a',
    padding: '0.75rem 1.5rem',
    borderRadius: 'var(--radius-lg)',
    fontWeight: '800',
    fontSize: '0.95rem',
    letterSpacing: '0.1em',
    boxShadow: '0 0 20px rgba(255,215,0,0.5)',
  },
  turnIndicatorOther: {
    background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-card) 100%)',
    color: 'var(--text-primary)',
    boxShadow: '0 0 10px rgba(212,175,55,0.3)',
    border: '2px solid var(--monopoly-gold)',
  },
  logoutButton: {
    padding: '0.5rem 1.25rem',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  sidebar: {
    width: '300px',
    background: 'var(--bg-secondary)',
    padding: '1rem',
    overflowY: 'auto',
    borderRight: '2px solid var(--border-color)',
    flexShrink: 0,
  },
  section: {
    marginBottom: '1.5rem',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '1.1rem',
    fontWeight: '700',
    color: 'var(--monopoly-gold)',
    marginBottom: '1rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  sectionIcon: {
    fontSize: '1.5rem',
  },
  playersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  playerCard: {
    background: 'var(--bg-card)',
    padding: '1rem',
    borderRadius: 'var(--radius-md)',
    border: '2px solid transparent',
    transition: 'all 0.3s ease',
  },
  playerCardActive: {
    border: '2px solid var(--monopoly-gold)',
    background: 'linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(184,147,43,0.05) 100%)',
    boxShadow: '0 0 15px rgba(212,175,55,0.3)',
  },
  playerCardBankrupt: {
    opacity: 0.4,
    filter: 'grayscale(1)',
  },
  playerHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.5rem',
  },
  playerColorDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.3)',
    boxShadow: '0 0 8px rgba(0,0,0,0.3)',
  },
  playerToken: {
    fontSize: '2rem',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontWeight: '700',
    color: 'var(--text-primary)',
    fontSize: '1rem',
  },
  playerRole: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    textTransform: 'capitalize',
  },
  playerMoney: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--monopoly-gold)',
    marginTop: '0.5rem',
  },
  jailBadge: {
    marginTop: '0.5rem',
    padding: '0.25rem 0.5rem',
    background: 'rgba(227, 30, 36, 0.2)',
    border: '1px solid var(--monopoly-red)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8rem',
    color: '#FFB3B3',
    display: 'inline-block',
  },
  jailCardBadge: {
    marginTop: '0.5rem',
    padding: '0.25rem 0.5rem',
    background: 'rgba(255, 215, 0, 0.2)',
    border: '1px solid var(--monopoly-gold)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8rem',
    color: '#FFD700',
    display: 'inline-block',
    fontWeight: '600',
  },
  bankruptBadge: {
    marginTop: '0.5rem',
    padding: '0.25rem 0.5rem',
    background: 'rgba(100, 100, 100, 0.3)',
    border: '1px solid #666',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8rem',
    color: '#999',
    display: 'inline-block',
    fontWeight: '700',
  },
  actionButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  actionButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  },
  tradeButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    background: 'linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%)',
    border: 'none',
    padding: '0.75rem',
    borderRadius: 'var(--radius-md)',
    color: 'white',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  actionIcon: {
    fontSize: '1.25rem',
  },
  diceDisplay: {
    background: 'var(--bg-card)',
    padding: '1rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)',
  },
  diceContainer: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  die: {
    width: '60px',
    height: '60px',
    background: 'linear-gradient(135deg, var(--monopoly-red) 0%, var(--monopoly-dark-red) 100%)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    fontWeight: '700',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-md)',
  },
  diceTotal: {
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: '1rem',
    fontWeight: '600',
  },
  doublesIndicator: {
    textAlign: 'center',
    color: 'var(--monopoly-gold)',
    fontSize: '0.95rem',
    fontWeight: '700',
    marginTop: '0.5rem',
  },
  gameLog: {
    background: 'var(--bg-card)',
    padding: '0.75rem',
    borderRadius: 'var(--radius-md)',
    height: '150px',
    overflowY: 'auto',
    border: '1px solid var(--border-color)',
  },
  logEntry: {
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    marginBottom: '0.5rem',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  boardContainer: {
    flex: 1,
    position: 'relative',
    background: 'var(--bg-primary)',
    minHeight: 0,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertiesSection: {
    marginTop: '0.75rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid rgba(255,255,255,0.1)',
  },
  propertiesHeader: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--monopoly-gold)',
    marginBottom: '0.5rem',
  },
  propertiesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  propertyItem: {
    background: 'rgba(255,255,255,0.05)',
    padding: '0.5rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  propertyName: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '0.25rem',
  },
  propertyDetails: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.75rem',
  },
  propertyPrice: {
    color: 'var(--monopoly-gold)',
    fontWeight: '600',
  },
  propertyHouses: {
    fontSize: '0.9rem',
  },
  mortgagedBadge: {
    fontSize: '0.9rem',
  },
  noProperties: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '0.5rem',
  },
  popupOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 1000,
    paddingTop: '2rem',
  },
  popup: {
    background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-card) 100%)',
    border: '3px solid var(--monopoly-gold)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.5rem',
    minWidth: '400px',
    maxWidth: '500px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: '1rem',
    right: '1rem',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: 'var(--text-primary)',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  popupHeader: {
    textAlign: 'center',
    marginBottom: '1.5rem',
  },
  popupIcon: {
    fontSize: '3rem',
    display: 'block',
    marginBottom: '0.5rem',
  },
  popupTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: 'var(--monopoly-gold)',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  popupContent: {
    textAlign: 'center',
  },
  popupPropertyName: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
  },
  popupPropertyType: {
    fontSize: '1rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '1.5rem',
  },
  popupDetails: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  popupDetailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.75rem',
    fontSize: '1rem',
    color: 'var(--text-secondary)',
  },
  popupDetailValue: {
    fontWeight: '700',
    color: 'var(--monopoly-gold)',
  },
  cardDrawnBy: {
    fontSize: '1rem',
    color: 'var(--text-secondary)',
    marginBottom: '1.5rem',
    fontWeight: '600',
    textAlign: 'center',
  },
  cardText: {
    fontSize: '1.25rem',
    color: 'var(--text-primary)',
    lineHeight: '1.6',
    padding: '1.5rem',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid rgba(255,255,255,0.1)',
    fontStyle: 'italic',
    textAlign: 'center',
  },
};

export default Game;
