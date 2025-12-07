import { useState, useEffect } from 'react';
import useGameStore from '../store/gameStore';
import socketService from '../services/socket';

const Trade = ({ isOpen, onClose }) => {
  const { user, players, myPlayer, properties, token } = useGameStore();

  const [activeTab, setActiveTab] = useState('send'); // 'send' or 'received'
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [myOfferedProperties, setMyOfferedProperties] = useState([]);
  const [myOfferedMoney, setMyOfferedMoney] = useState(0);
  const [myOfferedJailCards, setMyOfferedJailCards] = useState(0);
  const [theirRequestedProperties, setTheirRequestedProperties] = useState([]);
  const [theirRequestedMoney, setTheirRequestedMoney] = useState(0);
  const [theirRequestedJailCards, setTheirRequestedJailCards] = useState(0);
  const [receivedOffers, setReceivedOffers] = useState([]);
  const [sentOffers, setSentOffers] = useState([]);
  const [expandedOfferId, setExpandedOfferId] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || '';

  // Fetch trades when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTrades();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Listen for trade socket events and refresh trade list
  useEffect(() => {
    const socket = socketService.socket;
    if (!socket) return;

    const handleTradeEvent = () => {
      // Refresh trades whenever any trade event occurs
      if (isOpen) {
        fetchTrades();
      }
    };

    // Listen to all trade-related socket events
    socket.on('trade:new_offer', handleTradeEvent);
    socket.on('trade:accepted', handleTradeEvent);
    socket.on('trade:rejected', handleTradeEvent);
    socket.on('trade:countered', handleTradeEvent);
    socket.on('trade:cancelled', handleTradeEvent);

    // Cleanup listeners on unmount
    return () => {
      socket.off('trade:new_offer', handleTradeEvent);
      socket.off('trade:accepted', handleTradeEvent);
      socket.off('trade:rejected', handleTradeEvent);
      socket.off('trade:countered', handleTradeEvent);
      socket.off('trade:cancelled', handleTradeEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchTrades = async () => {
    try {
      const response = await fetch(`${API_URL}/api/trade`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to fetch trades:', data.message);
        return;
      }

      // Ensure data is an array
      const trades = Array.isArray(data) ? data : [];

      setReceivedOffers(trades.filter(t => t.recipient_id === myPlayer?.id));
      setSentOffers(trades.filter(t => t.proposer_id === myPlayer?.id));
    } catch (error) {
      console.error('Failed to fetch trades:', error);
    }
  };

  const handleSendOffer = async () => {
    if (!selectedPlayer) {
      alert('Please select a player');
      return;
    }

    if (myOfferedProperties.length === 0 && myOfferedMoney === 0 && myOfferedJailCards === 0 &&
        theirRequestedProperties.length === 0 && theirRequestedMoney === 0 && theirRequestedJailCards === 0) {
      alert('Please add items to the trade');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/trade`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipientPlayerId: selectedPlayer.id,
          offeredProperties: myOfferedProperties,
          offeredMoney: myOfferedMoney,
          offeredJailCards: myOfferedJailCards,
          requestedProperties: theirRequestedProperties,
          requestedMoney: theirRequestedMoney,
          requestedJailCards: theirRequestedJailCards
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to send offer');
      }

      // Reset form
      setMyOfferedProperties([]);
      setMyOfferedMoney(0);
      setMyOfferedJailCards(0);
      setTheirRequestedProperties([]);
      setTheirRequestedMoney(0);
      setTheirRequestedJailCards(0);

      alert('Trade offer sent!');
      fetchTrades();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleAcceptOffer = async (tradeId) => {
    try {
      const response = await fetch(`${API_URL}/api/trade/${tradeId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to accept offer');
      }

      alert('Trade accepted!');
      fetchTrades();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleRejectOffer = async (tradeId) => {
    try {
      const response = await fetch(`${API_URL}/api/trade/${tradeId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to reject offer');
      }

      alert('Trade rejected');
      fetchTrades();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleCancelOffer = async (tradeId) => {
    try {
      const response = await fetch(`${API_URL}/api/trade/${tradeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to cancel offer');
      }

      alert('Trade cancelled');
      fetchTrades();
    } catch (error) {
      alert(error.message);
    }
  };

  if (!isOpen) return null;

  const myProperties = properties.filter(p => p.owner_id === myPlayer?.id && !p.is_mortgaged && p.house_count === 0);
  const theirProperties = selectedPlayer
    ? properties.filter(p => p.owner_id === selectedPlayer.id && !p.is_mortgaged && p.house_count === 0)
    : [];
  const otherPlayers = players.filter(p => p.id !== myPlayer?.id && !p.is_bankrupt);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Trade Center</h2>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          <button
            style={{...styles.tab, ...(activeTab === 'send' ? styles.activeTab : {})}}
            onClick={() => setActiveTab('send')}
          >
            Send Offer
          </button>
          <button
            style={{...styles.tab, ...(activeTab === 'received' ? styles.activeTab : {})}}
            onClick={() => setActiveTab('received')}
          >
            Received Offers ({receivedOffers.length})
          </button>
          <button
            style={{...styles.tab, ...(activeTab === 'sent' ? styles.activeTab : {})}}
            onClick={() => setActiveTab('sent')}
          >
            Sent Offers ({sentOffers.length})
          </button>
        </div>

        <div style={styles.content}>
          {activeTab === 'send' && (
            <SendOfferTab
              myPlayer={myPlayer}
              myProperties={myProperties}
              theirProperties={theirProperties}
              otherPlayers={otherPlayers}
              selectedPlayer={selectedPlayer}
              setSelectedPlayer={setSelectedPlayer}
              myOfferedProperties={myOfferedProperties}
              setMyOfferedProperties={setMyOfferedProperties}
              myOfferedMoney={myOfferedMoney}
              setMyOfferedMoney={setMyOfferedMoney}
              myOfferedJailCards={myOfferedJailCards}
              setMyOfferedJailCards={setMyOfferedJailCards}
              theirRequestedProperties={theirRequestedProperties}
              setTheirRequestedProperties={setTheirRequestedProperties}
              theirRequestedMoney={theirRequestedMoney}
              setTheirRequestedMoney={setTheirRequestedMoney}
              theirRequestedJailCards={theirRequestedJailCards}
              setTheirRequestedJailCards={setTheirRequestedJailCards}
              onSendOffer={handleSendOffer}
            />
          )}

          {activeTab === 'received' && (
            <ReceivedOffersTab
              offers={receivedOffers}
              properties={properties}
              expandedOfferId={expandedOfferId}
              setExpandedOfferId={setExpandedOfferId}
              onAccept={handleAcceptOffer}
              onReject={handleRejectOffer}
            />
          )}

          {activeTab === 'sent' && (
            <SentOffersTab
              offers={sentOffers}
              properties={properties}
              expandedOfferId={expandedOfferId}
              setExpandedOfferId={setExpandedOfferId}
              onCancel={handleCancelOffer}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Send Offer Tab Component
const SendOfferTab = ({
  myPlayer, myProperties, theirProperties, otherPlayers,
  selectedPlayer, setSelectedPlayer,
  myOfferedProperties, setMyOfferedProperties,
  myOfferedMoney, setMyOfferedMoney,
  myOfferedJailCards, setMyOfferedJailCards,
  theirRequestedProperties, setTheirRequestedProperties,
  theirRequestedMoney, setTheirRequestedMoney,
  theirRequestedJailCards, setTheirRequestedJailCards,
  onSendOffer
}) => {
  const toggleMyProperty = (propId) => {
    setMyOfferedProperties(prev =>
      prev.includes(propId) ? prev.filter(id => id !== propId) : [...prev, propId]
    );
  };

  const toggleTheirProperty = (propId) => {
    setTheirRequestedProperties(prev =>
      prev.includes(propId) ? prev.filter(id => id !== propId) : [...prev, propId]
    );
  };

  return (
    <div style={styles.sendOfferContainer}>
      {/* My Side */}
      <div style={styles.tradeSide}>
        <h3 style={styles.sideTitle}>You Offer</h3>

        <div style={styles.moneySection}>
          <label style={styles.label}>Money: ${myPlayer?.money || 0} available</label>
          <input
            type="number"
            min="0"
            max={myPlayer?.money || 0}
            value={myOfferedMoney}
            onChange={(e) => setMyOfferedMoney(Math.min(parseInt(e.target.value) || 0, myPlayer?.money || 0))}
            style={styles.input}
          />
        </div>

        {myPlayer?.get_out_of_jail_cards > 0 && (
          <div style={styles.moneySection}>
            <label style={styles.label}>Jail Cards: {myPlayer.get_out_of_jail_cards} available</label>
            <input
              type="number"
              min="0"
              max={myPlayer.get_out_of_jail_cards}
              value={myOfferedJailCards}
              onChange={(e) => setMyOfferedJailCards(Math.min(parseInt(e.target.value) || 0, myPlayer.get_out_of_jail_cards))}
              style={styles.input}
            />
          </div>
        )}

        <div style={styles.propertyList}>
          <h4 style={styles.propertyListTitle}>Properties</h4>
          {myProperties.length === 0 ? (
            <p style={styles.noProperties}>No tradeable properties</p>
          ) : (
            myProperties.map(prop => (
              <div
                key={prop.id}
                style={{
                  ...styles.propertyItem,
                  ...(myOfferedProperties.includes(prop.id) ? styles.selectedProperty : {})
                }}
                onClick={() => toggleMyProperty(prop.id)}
              >
                <div style={{...styles.colorBar, background: prop.color_group || '#999'}} />
                <span>{prop.name}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Player Selection */}
      <div style={styles.centerSection}>
        <div style={styles.playerSelector}>
          <label style={styles.label}>Trade With:</label>
          <select
            value={selectedPlayer?.id || ''}
            onChange={(e) => {
              const player = otherPlayers.find(p => p.id === parseInt(e.target.value));
              setSelectedPlayer(player);
              setTheirRequestedProperties([]);
            }}
            style={styles.select}
          >
            <option value="">Select Player</option>
            {otherPlayers.map(player => (
              <option key={player.id} value={player.id}>
                {player.username}
              </option>
            ))}
          </select>
        </div>

        <button style={styles.sendButton} onClick={onSendOffer}>
          Send Offer
        </button>
      </div>

      {/* Their Side */}
      <div style={styles.tradeSide}>
        <h3 style={styles.sideTitle}>You Request</h3>

        <div style={styles.moneySection}>
          <label style={styles.label}>Money: ${selectedPlayer?.money || 0} available</label>
          <input
            type="number"
            min="0"
            max={selectedPlayer?.money || 0}
            value={theirRequestedMoney}
            onChange={(e) => setTheirRequestedMoney(Math.min(parseInt(e.target.value) || 0, selectedPlayer?.money || 0))}
            style={styles.input}
            disabled={!selectedPlayer}
          />
        </div>

        {selectedPlayer?.get_out_of_jail_cards > 0 && (
          <div style={styles.moneySection}>
            <label style={styles.label}>Jail Cards: {selectedPlayer.get_out_of_jail_cards} available</label>
            <input
              type="number"
              min="0"
              max={selectedPlayer.get_out_of_jail_cards}
              value={theirRequestedJailCards}
              onChange={(e) => setTheirRequestedJailCards(Math.min(parseInt(e.target.value) || 0, selectedPlayer.get_out_of_jail_cards))}
              style={styles.input}
            />
          </div>
        )}

        <div style={styles.propertyList}>
          <h4 style={styles.propertyListTitle}>Properties</h4>
          {!selectedPlayer ? (
            <p style={styles.noProperties}>Select a player</p>
          ) : theirProperties.length === 0 ? (
            <p style={styles.noProperties}>No tradeable properties</p>
          ) : (
            theirProperties.map(prop => (
              <div
                key={prop.id}
                style={{
                  ...styles.propertyItem,
                  ...(theirRequestedProperties.includes(prop.id) ? styles.selectedProperty : {})
                }}
                onClick={() => toggleTheirProperty(prop.id)}
              >
                <div style={{...styles.colorBar, background: prop.color_group || '#999'}} />
                <span>{prop.name}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// Received Offers Tab Component
const ReceivedOffersTab = ({ offers, properties, expandedOfferId, setExpandedOfferId, onAccept, onReject }) => {
  if (offers.length === 0) {
    return <p style={styles.noOffers}>No received offers</p>;
  }

  return (
    <div style={styles.offersList}>
      {offers.map(offer => (
        <OfferCard
          key={offer.id}
          offer={offer}
          properties={properties}
          isExpanded={expandedOfferId === offer.id}
          onToggle={() => setExpandedOfferId(expandedOfferId === offer.id ? null : offer.id)}
          onAccept={() => onAccept(offer.id)}
          onReject={() => onReject(offer.id)}
          showActions={true}
        />
      ))}
    </div>
  );
};

// Sent Offers Tab Component
const SentOffersTab = ({ offers, properties, expandedOfferId, setExpandedOfferId, onCancel }) => {
  if (offers.length === 0) {
    return <p style={styles.noOffers}>No sent offers</p>;
  }

  return (
    <div style={styles.offersList}>
      {offers.map(offer => (
        <OfferCard
          key={offer.id}
          offer={offer}
          properties={properties}
          isExpanded={expandedOfferId === offer.id}
          onToggle={() => setExpandedOfferId(expandedOfferId === offer.id ? null : offer.id)}
          onCancel={() => onCancel(offer.id)}
          showActions={false}
        />
      ))}
    </div>
  );
};

// Offer Card Component
const OfferCard = ({ offer, properties, isExpanded, onToggle, onAccept, onReject, onCancel, showActions }) => {
  const offeredProps = (offer.offered_properties_details || []);
  const requestedProps = (offer.requested_properties_details || []);

  return (
    <div style={styles.offerCard}>
      <div style={styles.offerHeader} onClick={onToggle}>
        <div>
          <strong>{offer.proposer_username}</strong> → <strong>{offer.recipient_username}</strong>
        </div>
        <div style={styles.offerPreview}>
          {offeredProps.length > 0 && <span>{offeredProps.length} prop(s)</span>}
          {offer.offered_money > 0 && <span>${offer.offered_money}</span>}
          {offer.offered_jail_cards > 0 && <span>{offer.offered_jail_cards} 🎴</span>}
          <span style={{margin: '0 8px'}}>↔</span>
          {requestedProps.length > 0 && <span>{requestedProps.length} prop(s)</span>}
          {offer.requested_money > 0 && <span>${offer.requested_money}</span>}
          {offer.requested_jail_cards > 0 && <span>{offer.requested_jail_cards} 🎴</span>}
        </div>
        <span style={{fontSize: '20px'}}>{isExpanded ? '▼' : '▶'}</span>
      </div>

      {isExpanded && (
        <div style={styles.offerDetails}>
          <div style={styles.offerSide}>
            <h4>Offering:</h4>
            {offeredProps.map(p => <div key={p.id} style={styles.offerProp}>{p.name}</div>)}
            {offer.offered_money > 0 && <div>${offer.offered_money}</div>}
            {offer.offered_jail_cards > 0 && <div>{offer.offered_jail_cards} Jail Card(s)</div>}
          </div>
          <div style={styles.offerSide}>
            <h4>Requesting:</h4>
            {requestedProps.map(p => <div key={p.id} style={styles.offerProp}>{p.name}</div>)}
            {offer.requested_money > 0 && <div>${offer.requested_money}</div>}
            {offer.requested_jail_cards > 0 && <div>{offer.requested_jail_cards} Jail Card(s)</div>}
          </div>

          {showActions && (
            <div style={styles.offerActions}>
              <button style={styles.acceptButton} onClick={onAccept}>Accept</button>
              <button style={styles.rejectButton} onClick={onReject}>Reject</button>
            </div>
          )}
          {!showActions && onCancel && (
            <div style={styles.offerActions}>
              <button style={styles.rejectButton} onClick={onCancel}>Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '1200px',
    maxHeight: '90vh',
    overflow: 'hidden',
    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
    border: '2px solid #4CAF50',
  },
  header: {
    padding: '1.5rem',
    borderBottom: '2px solid #4CAF50',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(76, 175, 80, 0.1)',
  },
  title: {
    margin: 0,
    color: '#4CAF50',
    fontSize: '24px',
    fontWeight: 'bold',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: '32px',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #333',
    background: 'rgba(0,0,0,0.2)',
  },
  tab: {
    flex: 1,
    padding: '1rem',
    background: 'transparent',
    border: 'none',
    color: '#aaa',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'all 0.3s',
    borderBottom: '3px solid transparent',
  },
  activeTab: {
    color: '#4CAF50',
    borderBottom: '3px solid #4CAF50',
    background: 'rgba(76, 175, 80, 0.1)',
  },
  content: {
    padding: '1.5rem',
    maxHeight: 'calc(90vh - 200px)',
    overflowY: 'auto',
  },
  sendOfferContainer: {
    display: 'flex',
    gap: '1.5rem',
  },
  tradeSide: {
    flex: 1,
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '8px',
    padding: '1rem',
  },
  centerSection: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '1rem',
    padding: '1rem',
  },
  sideTitle: {
    margin: '0 0 1rem 0',
    color: '#4CAF50',
    fontSize: '18px',
  },
  moneySection: {
    marginBottom: '1rem',
  },
  label: {
    display: 'block',
    color: '#aaa',
    fontSize: '12px',
    marginBottom: '0.5rem',
  },
  input: {
    width: '100%',
    padding: '0.5rem',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid #444',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '14px',
  },
  propertyList: {
    maxHeight: '300px',
    overflowY: 'auto',
  },
  propertyListTitle: {
    margin: '0 0 0.5rem 0',
    color: '#fff',
    fontSize: '14px',
  },
  propertyItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.5rem',
    marginBottom: '0.5rem',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: '2px solid transparent',
  },
  selectedProperty: {
    background: 'rgba(76, 175, 80, 0.2)',
    border: '2px solid #4CAF50',
  },
  colorBar: {
    width: '8px',
    height: '100%',
    minHeight: '30px',
    marginRight: '0.5rem',
    borderRadius: '2px',
  },
  noProperties: {
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '1rem',
  },
  playerSelector: {
    width: '200px',
  },
  select: {
    width: '100%',
    padding: '0.5rem',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid #444',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '14px',
  },
  sendButton: {
    padding: '1rem 2rem',
    background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  noOffers: {
    textAlign: 'center',
    color: '#666',
    padding: '2rem',
    fontSize: '16px',
  },
  offersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  offerCard: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #333',
  },
  offerHeader: {
    padding: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    background: 'rgba(0,0,0,0.2)',
  },
  offerPreview: {
    display: 'flex',
    gap: '0.5rem',
    fontSize: '14px',
    color: '#aaa',
  },
  offerDetails: {
    padding: '1rem',
    display: 'flex',
    gap: '1rem',
  },
  offerSide: {
    flex: 1,
  },
  offerProp: {
    padding: '0.5rem',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '4px',
    marginBottom: '0.5rem',
  },
  offerActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    justifyContent: 'center',
  },
  acceptButton: {
    padding: '0.75rem 1.5rem',
    background: '#4CAF50',
    border: 'none',
    borderRadius: '4px',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  rejectButton: {
    padding: '0.75rem 1.5rem',
    background: '#f44336',
    border: 'none',
    borderRadius: '4px',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
};

export default Trade;
